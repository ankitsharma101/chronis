import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '127.0.0.1',
  defaultUserId: process.env.DEFAULT_USER_ID || 'user_demo',
  defaultUserName: process.env.DEFAULT_USER_NAME || 'Demo User',
  databasePath: process.env.DATABASE_PATH || path.resolve(__dirname, '../chronis.db'),
  isDev: process.env.NODE_ENV !== 'production'
};
