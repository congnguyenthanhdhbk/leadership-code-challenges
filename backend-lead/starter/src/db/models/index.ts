import { sequelize } from '../sequelize';
import { Member, initMember } from './member';
import { Wallet, initWallet } from './wallet';
import { FundingTx, initFundingTx } from './fundingTx';
import { WalletTx, initWalletTx } from './walletTx';
import { PspCallback, initPspCallback } from './pspCallback';

initMember(sequelize);
initWallet(sequelize);
initFundingTx(sequelize);
initWalletTx(sequelize);
initPspCallback(sequelize);

Member.hasOne(Wallet, { foreignKey: 'memberId', as: 'wallet' });
Wallet.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });

Wallet.hasMany(FundingTx, { foreignKey: 'walletId', as: 'fundingTxs' });
FundingTx.belongsTo(Wallet, { foreignKey: 'walletId', as: 'wallet' });

Wallet.hasMany(WalletTx, { foreignKey: 'walletId', as: 'ledger' });
WalletTx.belongsTo(Wallet, { foreignKey: 'walletId', as: 'wallet' });
WalletTx.belongsTo(FundingTx, { foreignKey: 'fundingTxId', as: 'fundingTx' });

export { Member, Wallet, FundingTx, WalletTx, PspCallback };
export type { FundingTxKind, FundingTxStatus } from './fundingTx';
export type { WalletTxKind } from './walletTx';
export type { PspCallbackOutcome } from './pspCallback';
