import request from 'supertest';
import type { Express } from 'express';
import { sequelize } from '../src/db/sequelize';
import { WalletTx } from '../src/db/models';
import { dec, toMoney } from '../src/lib/money';

// Canonical 18-decimal string, e.g. money('100.5') === '100.500000000000000000'.
export const money = (v: string | number): string => toMoney(dec(v));

export async function createMember(app: Express, username = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`) {
  const res = await request(app).post('/members').send({ username });
  expect(res.status).toBe(201);
  return { memberId: res.body.member.id as string, walletId: res.body.wallet.id as string };
}

export async function createDeposit(app: Express, memberId: string, amount: string, turnoverMultiplier?: number) {
  const res = await request(app)
    .post('/deposits')
    .send({ memberId, amount, ...(turnoverMultiplier === undefined ? {} : { turnoverMultiplier }) });
  expect(res.status).toBe(201);
  return res.body as { id: string; pspRef: string; status: string; amount: string };
}

export function sendCallback(app: Express, pspRef: string, status: 'completed' | 'failed', amount: string) {
  return request(app).post('/psp/callbacks').send({ pspRef, status, amount });
}

// Deposit + completed callback. Returns the funding tx id and pspRef.
export async function completedDeposit(app: Express, memberId: string, amount: string, turnoverMultiplier?: number) {
  const dep = await createDeposit(app, memberId, amount, turnoverMultiplier);
  const cb = await sendCallback(app, dep.pspRef, 'completed', amount);
  expect(cb.status).toBe(200);
  return dep;
}

export async function getWallet(app: Express, memberId: string) {
  const res = await request(app).get(`/members/${memberId}/wallet`);
  expect(res.status).toBe(200);
  return res.body as { id: string; balance: string; turnoverRequired: string; turnoverAccrued: string };
}

export function placeWager(app: Express, walletId: string, amount: string) {
  return request(app).post(`/wallets/${walletId}/wagers`).send({ amount });
}

export function withdraw(app: Express, memberId: string, amount: string) {
  return request(app).post('/withdrawals').send({ memberId, amount });
}

// Ledger view for invariant assertions: signed sum and the latest balance_after.
export async function ledger(walletId: string) {
  const rows = await WalletTx.findAll({ where: { walletId }, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
  const [[sumRow]] = (await sequelize.query(
    'SELECT COALESCE(SUM(amount), 0)::text AS sum FROM wallet_txs WHERE wallet_id = :walletId',
    { replacements: { walletId } },
  )) as unknown as [[{ sum: string }], unknown];
  return {
    rows,
    count: rows.length,
    sum: money(sumRow.sum),
    lastBalanceAfter: rows.length ? money(rows[rows.length - 1].balanceAfter) : money(0),
  };
}
