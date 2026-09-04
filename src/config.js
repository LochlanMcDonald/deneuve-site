'use strict';

/**
 * Runtime configuration. Everything here can be overridden with environment
 * variables so the same build runs locally and on Azure App Service.
 */
const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',

  /** Upstream catalogue service. */
  api: {
    itemsUrl:
      process.env.ITEMS_API_URL ||
      'https://testdeneuve-fpfgfjbpcydxfzgc.canadacentral-01.azurewebsites.net/api/listItems',
    timeoutMs: Number(process.env.ITEMS_API_TIMEOUT_MS) || 8000,
    /** How long a good response is served straight from memory. */
    cacheTtlMs: Number(process.env.ITEMS_CACHE_TTL_MS) || 5 * 60 * 1000,
    /** How long a stale response may still be served if upstream is down. */
    staleTtlMs: Number(process.env.ITEMS_STALE_TTL_MS) || 24 * 60 * 60 * 1000,
  },

  shop: {
    name: 'Deneuve',
    currency: 'CAD',
  },
};

module.exports = config;
