import { createIsolatedDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';

export interface TestContext {
  baseUrl: string;
  server: Server;
  close: () => Promise<void>;
  authHeaders: Record<string, string>;
}

export async function setupTestApp(userId: string = 'test_user'): Promise<TestContext> {
  const db = createIsolatedDatabase(':memory:');
  const app = createApp(db);

  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${addr.port}`;

      const close = () => {
        return new Promise<void>((res) => {
          server.close(() => res());
        });
      };

      resolve({
        baseUrl,
        server,
        close,
        authHeaders: {
          'X-User-Id': userId,
          'Content-Type': 'application/json'
        }
      });
    });
  });
}
