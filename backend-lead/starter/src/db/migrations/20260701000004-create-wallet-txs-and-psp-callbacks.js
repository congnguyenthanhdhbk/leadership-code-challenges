'use strict';

// wallet_txs: append-only ledger. Every change to wallets.balance writes exactly one row
// here in the same transaction. `amount` is signed (credits positive, debits negative) so
// SUM(amount) over a wallet equals its balance; `balance_after` pins the running balance
// so any drift can be located to the exact entry. No updated_at: rows are never updated.
//
// psp_callbacks: raw inbox of every callback delivery, written before any money moves so
// a crash mid-processing still leaves evidence. Also the replay source for adapter tests.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wallet_txs', {
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
      funding_tx_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'funding_txs', key: 'id' },
      },
      kind: {
        type: Sequelize.ENUM('deposit_credit', 'wager_debit', 'withdrawal_debit'),
        allowNull: false,
      },
      amount: { type: Sequelize.DECIMAL(36, 18), allowNull: false },
      balance_after: { type: Sequelize.DECIMAL(36, 18), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
    });
    await queryInterface.addIndex('wallet_txs', ['wallet_id', 'created_at'], {
      name: 'wallet_txs_wallet_id_created_at_idx',
    });
    // Append-only is enforced by the database, not only by convention in src/.
    await queryInterface.sequelize.query(`
      CREATE FUNCTION wallet_txs_reject_mutation() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'wallet_txs is append-only: % is not allowed', TG_OP;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryInterface.sequelize.query(`
      CREATE TRIGGER wallet_txs_append_only
      BEFORE UPDATE OR DELETE ON wallet_txs
      FOR EACH ROW EXECUTE FUNCTION wallet_txs_reject_mutation();
    `);

    await queryInterface.createTable('psp_callbacks', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      psp_ref: { type: Sequelize.STRING(128), allowNull: false },
      payload: { type: Sequelize.JSONB, allowNull: false },
      // received: persisted, not yet processed (or processing crashed).
      // applied: this delivery moved the funding tx to a terminal state.
      // duplicate: same outcome already applied; acknowledged as a no-op.
      // orphan: no funding tx with this psp_ref.
      // rejected: conflicts with a terminal state; nothing written.
      outcome: {
        type: Sequelize.ENUM('received', 'applied', 'duplicate', 'orphan', 'rejected'),
        allowNull: false,
        defaultValue: 'received',
      },
      received_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
      processed_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('psp_callbacks', ['psp_ref'], { name: 'psp_callbacks_psp_ref_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('psp_callbacks');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_psp_callbacks_outcome"');
    await queryInterface.dropTable('wallet_txs');
    await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS wallet_txs_reject_mutation()');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_wallet_txs_kind"');
  },
};
