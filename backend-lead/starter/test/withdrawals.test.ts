import { randomUUID } from 'crypto';
import { createApp } from '../src/app';
import { sequelize } from '../src/db/sequelize';
import { FundingTx } from '../src/db/models';
import {
  completedDeposit,
  createMember,
  getWallet,
  ledger,
  money,
  placeWager,
  sendCallback,
  withdraw,
} from './helpers';

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

describe('POST /withdrawals', () => {
  it('turnover lock blocks, then unblocks once wagers reach the requirement; ledger reconstructs balance', async () => {
    const { memberId, walletId } = await createMember(app);

    // multiplier 0 adds nothing to the requirement; multiplier 1 adds 100.
    await completedDeposit(app, memberId, '100', 0);
    await completedDeposit(app, memberId, '100', 1);
    let wallet = await getWallet(app, memberId);
    expect(wallet.balance).toBe(money('200'));
    expect(wallet.turnoverRequired).toBe(money('100'));

    expect((await placeWager(app, walletId, '60')).status).toBe(201);

    const blocked = await withdraw(app, memberId, '50');
    expect(blocked.status).toBe(422);
    expect(blocked.body).toEqual({
      error: 'turnover_not_met',
      required: money('100'),
      accrued: money('60'),
      outstanding: money('40'),
    });
    // Nothing moved.
    wallet = await getWallet(app, memberId);
    expect(wallet.balance).toBe(money('140'));
    expect(await FundingTx.count({ where: { walletId, kind: 'withdrawal' } })).toBe(0);

    expect((await placeWager(app, walletId, '40')).status).toBe(201);

    const allowed = await withdraw(app, memberId, '50');
    expect(allowed.status).toBe(201);
    expect(allowed.body).toMatchObject({ status: 'Pending', amount: money('50'), balance: money('50') });

    const payout = await FundingTx.findByPk(allowed.body.id);
    expect(payout?.kind).toBe('withdrawal');
    expect(payout?.status).toBe('Pending');
    expect(payout?.walletId).toBe(walletId);

    wallet = await getWallet(app, memberId);
    expect(wallet.balance).toBe(money('50'));
    expect(wallet.turnoverRequired).toBe(money('100'));
    expect(wallet.turnoverAccrued).toBe(money('100'));

    // Ledger invariant: +100 +100 -60 -40 -50 = 50, and the last balance_after agrees.
    const l = await ledger(walletId);
    expect(l.rows.map((r) => r.kind)).toEqual([
      'deposit_credit',
      'deposit_credit',
      'wager_debit',
      'wager_debit',
      'withdrawal_debit',
    ]);
    expect(l.sum).toBe(money('50'));
    expect(l.lastBalanceAfter).toBe(money('50'));
    expect(l.rows[4].fundingTxId).toBe(allowed.body.id);
  });

  it('a second withdrawal is allowed without new wagers: turnover is not reset by withdrawing', async () => {
    const { memberId, walletId } = await createMember(app);
    await completedDeposit(app, memberId, '100', 1);
    await placeWager(app, walletId, '100');
    await completedDeposit(app, memberId, '100', 0);

    expect((await withdraw(app, memberId, '30')).status).toBe(201);
    expect((await withdraw(app, memberId, '30')).status).toBe(201);
    expect((await getWallet(app, memberId)).balance).toBe(money('40'));
  });

  it('withdrawal larger than balance is rejected after the turnover gate, with nothing written', async () => {
    const { memberId, walletId } = await createMember(app);
    await completedDeposit(app, memberId, '100', 0);

    const res = await withdraw(app, memberId, '100.01');

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: 'insufficient_balance',
      balance: money('100'),
      requested: money('100.01'),
    });
    expect((await getWallet(app, memberId)).balance).toBe(money('100'));
    expect(await FundingTx.count({ where: { walletId, kind: 'withdrawal' } })).toBe(0);
    expect((await ledger(walletId)).count).toBe(1);
  });

  it('turnover is checked before balance', async () => {
    const { memberId } = await createMember(app);
    await completedDeposit(app, memberId, '100', 1);

    const res = await withdraw(app, memberId, '1000');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('turnover_not_met');
  });

  it('a PSP callback for a withdrawal pspRef is rejected and never credits the wallet', async () => {
    const { memberId } = await createMember(app);
    await completedDeposit(app, memberId, '100', 0);
    const w = await withdraw(app, memberId, '50');
    const payout = await FundingTx.findByPk(w.body.id);

    const res = await sendCallback(app, payout!.pspRef, 'completed', '50');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('unsupported_callback');
    expect((await getWallet(app, memberId)).balance).toBe(money('50'));
  });

  it('returns 404 for an unknown member', async () => {
    const res = await withdraw(app, randomUUID(), '10');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
