import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../src/app';
import { sequelize } from '../src/db/sequelize';
import { FundingTx, PspCallback } from '../src/db/models';
import { createDeposit, createMember, getWallet, ledger, money, sendCallback } from './helpers';

const app = createApp();

beforeAll(async () => {
  await sequelize.authenticate();
});

beforeEach(async () => {
  await sequelize.truncate({ cascade: true });
});

afterAll(async () => {
  await sequelize.close();
});

async function inboxOutcomes(pspRef: string) {
  const rows = await PspCallback.findAll({ where: { pspRef }, order: [['receivedAt', 'ASC']] });
  return rows.map((r) => r.outcome);
}

describe('POST /psp/callbacks', () => {
  it('completes a deposit: credits the wallet once, writes one ledger row, adds turnover requirement', async () => {
    const { memberId, walletId } = await createMember(app);
    const dep = await createDeposit(app, memberId, '100.50', 2);

    const res = await sendCallback(app, dep.pspRef, 'completed', '100.50');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: dep.id,
      status: 'Completed',
      settledAmount: money('100.50'),
      amountMismatch: false,
      applied: true,
    });

    const wallet = await getWallet(app, memberId);
    expect(wallet.balance).toBe(money('100.50'));
    expect(wallet.turnoverRequired).toBe(money('201.00'));
    expect(wallet.turnoverAccrued).toBe(money(0));

    const l = await ledger(walletId);
    expect(l.count).toBe(1);
    expect(l.rows[0].kind).toBe('deposit_credit');
    expect(l.rows[0].fundingTxId).toBe(dep.id);
    expect(l.sum).toBe(money('100.50'));
    expect(l.lastBalanceAfter).toBe(money('100.50'));
    expect(await inboxOutcomes(dep.pspRef)).toEqual(['applied']);
  });

  it('sequential duplicate: the same completed callback twice credits once', async () => {
    const { memberId, walletId } = await createMember(app);
    const dep = await createDeposit(app, memberId, '100');

    const first = await sendCallback(app, dep.pspRef, 'completed', '100');
    const second = await sendCallback(app, dep.pspRef, 'completed', '100');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.applied).toBe(true);
    expect(second.body.applied).toBe(false);
    expect(second.body.status).toBe('Completed');

    expect((await getWallet(app, memberId)).balance).toBe(money('100'));
    const l = await ledger(walletId);
    expect(l.count).toBe(1);
    expect(l.sum).toBe(money('100'));
    expect(await inboxOutcomes(dep.pspRef)).toEqual(['applied', 'duplicate']);
  });

  it('concurrent duplicates: 10 identical callbacks in flight together credit once', async () => {
    const { memberId, walletId } = await createMember(app);
    const dep = await createDeposit(app, memberId, '100');

    // Build every request before awaiting any of them, so they are genuinely in flight
    // at the same time and the row lock is what serialises them.
    const N = 10;
    const responses = await Promise.all(
      Array.from({ length: N }, () => sendCallback(app, dep.pspRef, 'completed', '100')),
    );

    expect(responses.map((r) => r.status)).toEqual(Array(N).fill(200));
    expect(responses.filter((r) => r.body.applied === true)).toHaveLength(1);
    expect(responses.filter((r) => r.body.applied === false)).toHaveLength(N - 1);

    expect((await getWallet(app, memberId)).balance).toBe(money('100'));
    const l = await ledger(walletId);
    expect(l.count).toBe(1);
    expect(l.sum).toBe(money('100'));

    const outcomes = await inboxOutcomes(dep.pspRef);
    expect(outcomes).toHaveLength(N);
    expect(outcomes.filter((o) => o === 'applied')).toHaveLength(1);
    expect(outcomes.filter((o) => o === 'duplicate')).toHaveLength(N - 1);
  });

  it('failed callback: moves to Failed, no balance change, no ledger row, no turnover requirement', async () => {
    const { memberId, walletId } = await createMember(app);
    const dep = await createDeposit(app, memberId, '100');

    const res = await sendCallback(app, dep.pspRef, 'failed', '100');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Failed');
    expect(res.body.applied).toBe(true);

    const wallet = await getWallet(app, memberId);
    expect(wallet.balance).toBe(money(0));
    expect(wallet.turnoverRequired).toBe(money(0));
    expect((await ledger(walletId)).count).toBe(0);
  });

  describe('state machine', () => {
    it('rejects failed after Completed with 409 and changes nothing', async () => {
      const { memberId, walletId } = await createMember(app);
      const dep = await createDeposit(app, memberId, '100');
      await sendCallback(app, dep.pspRef, 'completed', '100');

      const res = await sendCallback(app, dep.pspRef, 'failed', '100');

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'invalid_transition', from: 'Completed', to: 'Failed' });
      expect((await FundingTx.findByPk(dep.id))?.status).toBe('Completed');
      expect((await getWallet(app, memberId)).balance).toBe(money('100'));
      expect((await ledger(walletId)).count).toBe(1);
      expect(await inboxOutcomes(dep.pspRef)).toEqual(['applied', 'rejected']);
    });

    it('rejects completed after Failed with 409 and does not credit', async () => {
      const { memberId, walletId } = await createMember(app);
      const dep = await createDeposit(app, memberId, '100');
      await sendCallback(app, dep.pspRef, 'failed', '100');

      const res = await sendCallback(app, dep.pspRef, 'completed', '100');

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: 'invalid_transition', from: 'Failed', to: 'Completed' });
      expect((await FundingTx.findByPk(dep.id))?.status).toBe('Failed');
      expect((await getWallet(app, memberId)).balance).toBe(money(0));
      expect((await ledger(walletId)).count).toBe(0);
    });

    it('acknowledges a repeated failed callback as a no-op', async () => {
      const { memberId } = await createMember(app);
      const dep = await createDeposit(app, memberId, '100');
      await sendCallback(app, dep.pspRef, 'failed', '100');

      const res = await sendCallback(app, dep.pspRef, 'failed', '100');
      expect(res.status).toBe(200);
      expect(res.body.applied).toBe(false);
      expect(await inboxOutcomes(dep.pspRef)).toEqual(['applied', 'duplicate']);
    });
  });

  it('amount mismatch: credits the settled amount and flags the difference', async () => {
    const { memberId, walletId } = await createMember(app);
    const dep = await createDeposit(app, memberId, '100', 1);

    const res = await sendCallback(app, dep.pspRef, 'completed', '90');

    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(money('100'));
    expect(res.body.settledAmount).toBe(money('90'));
    expect(res.body.amountMismatch).toBe(true);

    const row = await FundingTx.findByPk(dep.id);
    expect(row?.settledAmount).toBe(money('90'));
    expect(row?.amountMismatch).toBe(true);

    const wallet = await getWallet(app, memberId);
    expect(wallet.balance).toBe(money('90'));
    // Turnover requirement follows the money that actually arrived.
    expect(wallet.turnoverRequired).toBe(money('90'));
    expect((await ledger(walletId)).sum).toBe(money('90'));
  });

  it('unknown pspRef: 404 and an orphan row in the inbox', async () => {
    const pspRef = randomUUID();
    const res = await sendCallback(app, pspRef, 'completed', '100');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found', resource: 'pspRef', id: pspRef });
    const rows = await PspCallback.findAll({ where: { pspRef } });
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe('orphan');
    expect(rows[0].payload).toEqual({ pspRef, status: 'completed', amount: '100' });
  });

  it('rejects a malformed body with 400', async () => {
    const res = await request(app).post('/psp/callbacks').send({ pspRef: 'x', status: 'done', amount: '1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });
});
