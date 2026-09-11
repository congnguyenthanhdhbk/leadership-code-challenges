'use strict';

// Funding transactions: money entering (deposit) or leaving (withdrawal) the platform.
// One row per PSP-facing operation. `psp_ref` is UNIQUE so there is never a second
// row for a callback to race against.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('funding_txs', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      wallet_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'wallets', key: 'id' },
      },
      kind: { type: Sequelize.ENUM('deposit', 'withdrawal'), allowNull: false },
      status: {
        type: Sequelize.ENUM('Pending', 'Completed', 'Failed'),
        allowNull: false,
        defaultValue: 'Pending',
      },
      // What the member asked for.
      amount: { type: Sequelize.DECIMAL(36, 18), allowNull: false },
      // What the PSP reported actually moved. Null until a terminal callback is applied.
      settled_amount: { type: Sequelize.DECIMAL(36, 18), allowNull: true },
      amount_mismatch: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      psp_ref: { type: Sequelize.STRING(128), allowNull: false, unique: true },
      turnover_multiplier: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
    });

    await queryInterface.addIndex('funding_txs', ['wallet_id'], { name: 'funding_txs_wallet_id_idx' });
    await queryInterface.sequelize.query(
      'ALTER TABLE funding_txs ADD CONSTRAINT funding_txs_amount_positive CHECK (amount > 0)',
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE funding_txs ADD CONSTRAINT funding_txs_turnover_multiplier_non_negative CHECK (turnover_multiplier >= 0)',
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('funding_txs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_funding_txs_kind"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_funding_txs_status"');
  },
};
