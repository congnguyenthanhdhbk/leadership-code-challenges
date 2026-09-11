'use strict';

// Turnover counters are lifetime totals: completed deposits add amount × multiplier to
// `turnover_required`, wagers add their amount to `turnover_accrued`. A withdrawal is
// allowed only when accrued >= required. The balance CHECK is the last line of defence
// behind the row lock in the service layer.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('wallets', 'turnover_required', {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: false,
      defaultValue: '0',
    });
    await queryInterface.addColumn('wallets', 'turnover_accrued', {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: false,
      defaultValue: '0',
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE wallets ADD CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0)',
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE wallets ADD CONSTRAINT wallets_turnover_required_non_negative CHECK (turnover_required >= 0)',
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE wallets ADD CONSTRAINT wallets_turnover_accrued_non_negative CHECK (turnover_accrued >= 0)',
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE wallets DROP CONSTRAINT wallets_turnover_accrued_non_negative');
    await queryInterface.sequelize.query('ALTER TABLE wallets DROP CONSTRAINT wallets_turnover_required_non_negative');
    await queryInterface.sequelize.query('ALTER TABLE wallets DROP CONSTRAINT wallets_balance_non_negative');
    await queryInterface.removeColumn('wallets', 'turnover_accrued');
    await queryInterface.removeColumn('wallets', 'turnover_required');
  },
};
