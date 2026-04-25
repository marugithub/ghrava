// @ts-check
'use strict';
/**
 * shared/errors.js
 * Standard error response helpers used by all route files.
 */

/** @typedef {import('express').Response} Response */

function notFound(res, resource = 'Record') {
  return res.status(404).json({ error: `${resource} not found` });
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

/**
 * Logs an error using string args so the server.js console.error wrapper
 * (which JSON.stringifies args) doesn't drop Error fields. Returns 500.
 */
function serverError(res, err) {
  if (err instanceof Error) {
    console.error('[serverError]', err.message);
    if (err.stack) console.error(err.stack);
  } else {
    console.error('[serverError]', String(err));
  }
  const msg = err instanceof Error ? err.message : String(err);
  return res.status(500).json({ error: msg });
}

module.exports = { notFound, badRequest, serverError };
