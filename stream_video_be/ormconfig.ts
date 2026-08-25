import path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseConfig } from './src/configs/database.config';

const dataSourceOptions: DataSourceOptions = {
  ...databaseConfig,
  migrations: [path.join(__dirname, 'src/database/migrations/*.{js,ts}')],
  seeds: [path.join(__dirname, 'src/database/seeders/*.{js,ts}')],
  cli: {
    entitiesDir: 'src',
    subscribersDir: 'src',
    migrationsDir: 'src/database/migrations',
  },
} as DataSourceOptions;

export const AppDataSource = new DataSource(dataSourceOptions);
export default dataSourceOptions;
