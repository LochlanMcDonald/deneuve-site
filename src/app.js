'use strict';

const path = require('path');
const express = require('express');
const compression = require('compression');

const config = require('./config');
const catalogue = require('./catalogue');
const { securityHeaders, requestLog, staticCache } = require('./middleware');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/**
 * Builds the Express application. Kept separate from listening so tests can
 * mount it on an ephemeral port without the process taking over a real one.
 */
function createApp({ quiet = false } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true); // Azure App Service terminates TLS upstream

  if (!quiet) app.use(requestLog);
  app.use(securityHeaders);
  app.use(compression());
  app.use(express.json({ limit: '32kb' }));

  // ------------------------------------------------------------------ API

  /** Liveness probe for Azure and uptime monitoring. */
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()), env: config.env });
  });

  /** Catalogue, proxied and cached server-side. */
  app.get('/api/items', async (req, res, next) => {
    try {
      const { items, source, fetchedAt, error } = await catalogue.getItems({
        force: req.query.refresh === '1',
      });
      // A shared cache may hold this, but never longer than our own TTL.
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
      res.setHeader('X-Catalogue-Source', source);
      res.status(source === 'empty' ? 503 : 200).json({
        items,
        count: items.length,
        currency: config.shop.currency,
        source,
        fetchedAt: fetchedAt || null,
        ...(error ? { error: 'Catalogue is temporarily unavailable.' } : {}),
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Alteration enquiries. Validates and records the request; wiring it to a
   * mailer or CRM means replacing the console.log below.
   */
  app.post('/api/enquiry', (req, res) => {
    const { name = '', email = '', service = '', message = '' } = req.body || {};
    const errors = {};

    if (!String(name).trim()) errors.name = 'Please tell us your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!String(message).trim()) errors.message = 'Please describe the piece.';
    else if (String(message).length > 4000) errors.message = 'Please keep it under 4000 characters.';

    if (Object.keys(errors).length) {
      return res.status(400).json({ ok: false, errors });
    }

    if (!quiet) {
      console.log(`[enquiry] ${String(email).trim()} — ${String(service) || 'unspecified'}`);
    }
    res.status(202).json({
      ok: true,
      message: 'Thank you — we will reply within one working day.',
    });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // --------------------------------------------------------------- Static

  app.use(
    express.static(PUBLIC_DIR, {
      extensions: ['html'],
      setHeaders: staticCache,
      maxAge: 0,
    })
  );

  // ---------------------------------------------------------- Errors / 404

  app.use((req, res) => {
    res.status(404);
    if (req.accepts('html')) return res.sendFile(path.join(PUBLIC_DIR, '404.html'));
    res.type('txt').send('Not found');
  });

  // eslint-disable-next-line no-unused-vars -- Express detects error handlers by arity
  app.use((err, req, res, next) => {
    if (!quiet) console.error('[error]', err.stack || err);
    res.status(err.status || 500);
    if (req.accepts('html')) return res.sendFile(path.join(PUBLIC_DIR, '500.html'));
    res.json({ error: 'Something went wrong.' });
  });

  return app;
}

module.exports = { createApp, PUBLIC_DIR };
