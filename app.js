'use strict';

/** Azure App Service entry point: build the app, listen, shut down cleanly. */

const config = require('./src/config');
const { createApp } = require('./src/app');

const server = createApp().listen(config.port, () => {
  console.log(`Deneuve is open on http://localhost:${config.port} (${config.env})`);
});

/** Finish in-flight requests before the platform reclaims the container. */
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received — closing down.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}

module.exports = server;
