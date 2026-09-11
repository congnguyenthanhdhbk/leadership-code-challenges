import { Router } from 'express';
import { z } from 'zod';
import { deposits } from '../container';
import { positiveAmount, turnoverMultiplier, uuid } from '../lib/validation';

export const depositsRouter = Router();

const createDepositBody = z.object({
  memberId: uuid,
  amount: positiveAmount,
  turnoverMultiplier,
});

depositsRouter.post('/', async (req, res, next) => {
  try {
    const body = createDepositBody.parse(req.body);
    const tx = await deposits.create(body);
    res.status(201).json({
      id: tx.id,
      pspRef: tx.pspRef,
      status: tx.status,
      amount: tx.amount,
      turnoverMultiplier: tx.turnoverMultiplier,
    });
  } catch (err) {
    next(err);
  }
});
