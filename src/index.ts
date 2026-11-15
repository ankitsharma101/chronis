import { config } from './config.js';
import { getDatabase } from './database.js';
import { createApp } from './app.js';

const db = getDatabase();
const app = createApp(db);

const server = app.listen(config.port, config.host, () => {
  console.log('\n' + '='.repeat(60));
  console.log('CHRONIS - Privacy-Aware Memory Timeline');
  console.log('='.repeat(60));
  console.log(` * Web Application UI:  http://${config.host}:${config.port}/`);
  console.log(` * Interactive Docs:     http://${config.host}:${config.port}/docs`);
  console.log(` * OpenAPI Schema:       http://${config.host}:${config.port}/openapi.json`);
  console.log(` * Database:             ${config.databasePath}`);
  console.log('='.repeat(60) + '\n');
});

export { app, server };
