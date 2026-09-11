import { Router } from 'express';
import { z } from 'zod';
import { withdrawals } from '../container';
import { positiveAmount, uuid } from '../lib/validation';

export const withdrawalsRouter = Router();

const createWithdrawalBody = z.object({
  memberId: uuid,
  amount: positiveAmount,
});

withdrawalsRouter.post('/', async (req, res, next) => {
  try {
    const body = createWithdrawalBody.parse(req.body);
    const result = await withdrawals.execute(body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});
