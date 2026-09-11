import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../src/app';
import { sequelize } from '../src/db/sequelize';
import { FundingTx } from '../src/db/models';
import { createMember, money } from './helpers';

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

describe('POST /deposits', () => {
  it('creates a Pending deposit with a pspRef and moves no money', async () => {
    const { memberId, walletId } = await createMember(app);

    const res = await request(app).post('/deposits').send({ memberId, amount: '100.50' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Pending');
    expect(res.body.amount).toBe(money('100.50'));
    expect(res.body.turnoverMultiplier).toBe(1);
    expect(typeof res.body.pspRef).toBe('string');

    const row = await FundingTx.findByPk(res.body.id);
    expect(row?.walletId).toBe(walletId);
    expect(row?.kind).toBe('deposit');

    const wallet = await request(app).get(`/members/${memberId}/wallet`);
    expect(wallet.body.balance).toBe(money(0));
  });

  it('accepts a turnoverMultiplier of 0', async () => {
    const { memberId } = await createMember(app);
    const res = await request(app).post('/deposits').send({ memberId, amount: '10', turnoverMultiplier: 0 });
    expect(res.status).toBe(201);
    expect(res.body.turnoverMultiplier).toBe(0);
  });

  it.each<[unknown, string]>([
    ['0', 'zero'],
    ['0.00', 'zero with decimals'],
    ['-5', 'negative'],
    ['1e3', 'exponent'],
    ['1,000', 'thousands separator'],
    ['.5', 'leading dot'],
    ['1.0000000000000000001', 'more than 18 fractional digits'],
    [100, 'a JS number'],
  ])('rejects amount %p (%s) with 400', async (amount) => {
    const { memberId } = await createMember(app);
    const res = await request(app).post('/deposits').send({ memberId, amount });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it.each<unknown>([-1, 1.5, '1'])('rejects turnoverMultiplier %p with 400', async (turnoverMultiplier) => {
    const { memberId } = await createMember(app);
    const res = await request(app).post('/deposits').send({ memberId, amount: '10', turnoverMultiplier });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown member', async () => {
    const res = await request(app).post('/deposits').send({ memberId: randomUUID(), amount: '10' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});
