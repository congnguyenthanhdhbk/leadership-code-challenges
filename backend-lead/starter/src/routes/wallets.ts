import { Router } from 'express';
import { z } from 'zod';
import { wagers } from '../container';
import { positiveAmount, uuid } from '../lib/validation';

export const walletsRouter = Router();

const wagerParams = z.object({ walletId: uuid });
const wagerBody = z.object({ amount: positiveAmount });

walletsRouter.post('/:walletId/wagers', async (req, res, next) => {
  try {
    const { walletId } = wagerParams.parse(req.params);
    const { amount } = wagerBody.parse(req.body);
    const result = await wagers.execute({ walletId, amount });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});
