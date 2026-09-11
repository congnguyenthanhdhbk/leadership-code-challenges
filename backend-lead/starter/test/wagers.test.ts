import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../src/app';
import { sequelize } from '../src/db/sequelize';
import { completedDeposit, createMember, getWallet, ledger, money, placeWager } from './helpers';

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

describe('POST /wallets/:walletId/wagers', () => {
  it('debits the wallet, accrues turnover and writes a signed ledger row', async () => {
    const { memberId, walletId } = await createMember(app);
    await completedDeposit(app, memberId, '100');

    const res = await placeWager(app, walletId, '10.25');

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ walletId, balance: money('89.75'), turnoverAccrued: money('10.25') });

    const wallet = await getWallet(app, memberId);
    expect(wallet.balance).toBe(money('89.75'));
    expect(wallet.turnoverAccrued).toBe(money('10.25'));

    const l = await ledger(walletId);
    expect(l.count).toBe(2);
    expect(l.rows[1].kind).toBe('wager_debit');
    expect(l.rows[1].amount).toBe(money('-10.25'));
    expect(l.rows[1].fundingTxId).toBeNull();
    expect(l.sum).toBe(money('89.75'));
    expect(l.lastBalanceAfter).toBe(money('89.75'));
  });

  it('rejects a wager larger than the balance with 422 and writes nothing', async () => {
    const { memberId, walletId } = await createMember(app);
    await completedDeposit(app, memberId, '100');

    const res = await placeWager(app, walletId, '100.01');

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: 'insufficient_balance',
      balance: money('100'),
      requested: money('100.01'),
    });
    expect((await getWallet(app, memberId)).balance).toBe(money('100'));
    expect((await ledger(walletId)).count).toBe(1);
  });

  it('allows a wager equal to the full balance', async () => {
    const { memberId, walletId } = await createMember(app);
    await completedDeposit(app, memberId, '100');

    const res = await placeWager(app, walletId, '100');
    expect(res.status).toBe(201);
    expect(res.body.balance).toBe(money(0));
  });

  it('concurrent wagers cannot overdraw: balance 100, ten wagers of 15, exactly six succeed', async () => {
    const { memberId, walletId } = await createMember(app);
    await completedDeposit(app, memberId, '100');

    const N = 10;
    const responses = await Promise.all(Array.from({ length: N }, () => placeWager(app, walletId, '15')));

    const ok = responses.filter((r) => r.status === 201);
    const rejected = responses.filter((r) => r.status === 422);
    expect(ok).toHaveLength(6);
    expect(rejected).toHaveLength(4);
    rejected.forEach((r) => expect(r.body.error).toBe('insufficient_balance'));

    const wallet = await getWallet(app, memberId);
    expect(wallet.balance).toBe(money('10'));
    expect(wallet.turnoverAccrued).toBe(money('90'));

    const l = await ledger(walletId);
    expect(l.count).toBe(1 + 6);
    expect(l.sum).toBe(money('10'));
    expect(l.lastBalanceAfter).toBe(money('10'));
    // Every successful response reported a balance that appears as a balance_after in the ledger.
    const balancesAfter = l.rows.map((r) => money(r.balanceAfter));
    ok.forEach((r) => expect(balancesAfter).toContain(r.body.balance));
  });

  it('returns 404 for an unknown wallet and 400 for a non-uuid id', async () => {
    const missing = await placeWager(app, randomUUID(), '1');
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('not_found');

    const bad = await request(app).post('/wallets/not-a-uuid/wagers').send({ amount: '1' });
    expect(bad.status).toBe(400);
  });
});
