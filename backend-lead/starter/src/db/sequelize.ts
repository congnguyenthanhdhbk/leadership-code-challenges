import { Sequelize } from 'sequelize';
import { config } from '../config';

export const sequelize = new Sequelize(config.databaseUrl, {
  dialect: 'postgres',
  logging: false,
  define: { underscored: true },
  // The concurrency tests fire 10+ requests at once. With the default pool of 5, half of
  // them would queue on the pool before reaching the row lock and the test would not be
  // exercising the lock at all. Size the pool above the tested concurrency.
  pool: { max: config.env === 'test' ? 25 : 10, min: 0 },
});
