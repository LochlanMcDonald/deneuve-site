'use strict';

const config = require('./config');

/**
 * Security headers. Hand-rolled rather than pulled from a dependency so the
 * policy is visible and reviewable in one place.
 *
 * The CSP is strict for scripts — all page behaviour lives in external files
 * under /assets/js, so no inline script is needed. `img-src` has to stay open
 * to https: because product photography is hosted by the upstream catalogue.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // inline style attributes for dynamic layout
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

function securityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), interest-cohort=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (config.env === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.removeHeader('X-Powered-By');
  next();
}

/** One line per request: method, path, status, duration. */
function requestLog(req, res, next) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
}

/**
 * Cache policy for static files. Fonts are content-stable and get a year;
 * other assets get a day with revalidation so a redeploy is picked up quickly.
 */
function staticCache(res, filePath) {
  if (/\.woff2?$/.test(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (/\.(css|js|png|jpe?g|webp|svg|ico)$/.test(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }
}

module.exports = { securityHeaders, requestLog, staticCache, CSP };
