import { Router } from 'express';
import { z } from 'zod';
import { pspCallbacks } from '../container';
import { positiveAmount } from '../lib/validation';

export const pspCallbacksRouter = Router();

const callbackBody = z.object({
  pspRef: z.string().min(1).max(128),
  status: z.enum(['completed', 'failed']),
  amount: positiveAmount,
});

// Retries of an already-applied outcome are acknowledged with 200 so the PSP stops
// retrying. Conflicts with a terminal state are 409; unknown refs are 404.
pspCallbacksRouter.post('/', async (req, res, next) => {
  try {
    const body = callbackBody.parse(req.body);
    const { applied, fundingTx } = await pspCallbacks.handle(body, req.body);
    res.status(200).json({
      id: fundingTx.id,
      pspRef: fundingTx.pspRef,
      status: fundingTx.status,
      amount: fundingTx.amount,
      settledAmount: fundingTx.settledAmount,
      amountMismatch: fundingTx.amountMismatch,
      applied,
    });
  } catch (err) {
    next(err);
  }
});
