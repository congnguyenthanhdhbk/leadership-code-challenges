// Composition root. The one place that knows how the services are wired together.
// Routes import from here; nothing else in src/ constructs a service or a repository.
import { SequelizeTransactionRunner } from './db/transactionRunner';
import { WalletRepository } from './repositories/walletRepository';
import { FundingTxRepository } from './repositories/fundingTxRepository';
import { LedgerRepository } from './repositories/ledgerRepository';
import { CallbackInboxRepository } from './repositories/callbackInboxRepository';
import { LedgerService } from './services/ledgerService';
import { DepositService } from './services/depositService';
import { WagerService } from './services/wagerService';
import { WithdrawalService } from './services/withdrawalService';
import { PspCallbackService } from './services/psp/pspCallbackService';
import { CompletedDepositHandler, FailedDepositHandler } from './services/psp/callbackOutcomeHandlers';

const transactions = new SequelizeTransactionRunner();

const wallets = new WalletRepository();
const fundingTxs = new FundingTxRepository();
const ledgerRows = new LedgerRepository();
const inbox = new CallbackInboxRepository();

const ledger = new LedgerService(wallets, ledgerRows);

export const deposits = new DepositService(wallets, fundingTxs);
export const wagers = new WagerService({ transactions, wallets, ledger });
export const withdrawals = new WithdrawalService({ transactions, wallets, ledger }, fundingTxs);
export const pspCallbacks = new PspCallbackService({
  transactions,
  fundingTxs,
  inbox,
  handlers: {
    completed: new CompletedDepositHandler(wallets, fundingTxs, ledger),
    failed: new FailedDepositHandler(fundingTxs),
  },
});
