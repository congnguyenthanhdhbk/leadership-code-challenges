import { createApp } from '../src/app';
import { sequelize } from '../src/db/sequelize';
import { WalletTx } from '../src/db/models';
import { dec } from '../src/lib/money';
import {
  completedDeposit,
  createDeposit,
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

describe('ledger invariants', () => {
  it('under a mixed concurrent load, SUM(wallet_txs.amount) equals the balance and the last balance_after agrees', async () => {
    const { memberId, walletId } = await createMember(app);
    await completedDeposit(app, memberId, '100', 0);

    // Three pending deposits, each of whose callbacks is delivered three times, racing with
    // eight wagers and two withdrawals. Everything is built first and awaited together.
    const deposits = await Promise.all([
      createDeposit(app, memberId, '50', 0),
      createDeposit(app, memberId, '25', 0),
      createDeposit(app, memberId, '10', 0),
    ]);
    const callbacks = deposits.flatMap((d) =>
      Array.from({ length: 3 }, () => sendCallback(app, d.pspRef, 'completed', d.amount)),
    );
    const wagers = Array.from({ length: 8 }, () => placeWager(app, walletId, '30'));
    const withdrawals = [withdraw(app, memberId, '40'), withdraw(app, memberId, '40')];

    const responses = await Promise.all([...callbacks, ...wagers, ...withdrawals]);
    // No request may fail for any reason other than running out of balance.
    responses.forEach((r) => expect([200, 201, 422]).toContain(r.status));
    responses.slice(0, callbacks.length).forEach((r) => expect(r.status).toBe(200));

    const wallet = await getWallet(app, memberId);
    const l = await ledger(walletId);

    // Exactly one credit per deposit regardless of how many deliveries raced.
    expect(l.rows.filter((r) => r.kind === 'deposit_credit')).toHaveLength(4);
    expect(l.sum).toBe(money(wallet.balance));
    expect(l.lastBalanceAfter).toBe(money(wallet.balance));
    // balance_after is a consistent running total over the rows in order, never negative.
    let running = dec(0);
    for (const row of l.rows) {
      running = running.plus(row.amount);
      expect(money(row.balanceAfter)).toBe(money(running.toFixed()));
      expect(running.isNegative()).toBe(false);
    }
  });

  it('is append-only at the database level: UPDATE and DELETE on wallet_txs are rejected', async () => {
    const { memberId, walletId } = await createMember(app);
    await completedDeposit(app, memberId, '100');
    const [row] = await WalletTx.findAll({ where: { walletId } });

    await expect(
      sequelize.query('UPDATE wallet_txs SET amount = 0 WHERE id = :id', { replacements: { id: row.id } }),
    ).rejects.toThrow(/append-only/);
    await expect(
      sequelize.query('DELETE FROM wallet_txs WHERE id = :id', { replacements: { id: row.id } }),
    ).rejects.toThrow(/append-only/);
    await expect(row.destroy()).rejects.toThrow(/append-only/);

    expect((await ledger(walletId)).sum).toBe(money('100'));
  });

  it('the balance CHECK constraint is the last line of defence behind the row lock', async () => {
    const { memberId, walletId } = await createMember(app);
    await completedDeposit(app, memberId, '10');

    await expect(
      sequelize.query('UPDATE wallets SET balance = -1 WHERE id = :id', { replacements: { id: walletId } }),
    ).rejects.toThrow(/wallets_balance_non_negative/);
  });
});
