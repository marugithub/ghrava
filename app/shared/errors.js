// @ts-check
'use strict';
/**
 * shared/errors.js
 * Standard error response helpers used by all route files.
 */

/** @typedef {import('express').Response} Response */

/**
 * @param {Response} res
 * @param {string} [resource]
 * @returns {Response}
 */
function notFound(res, resource = 'Record') {
  return res.status(404).json({ error: `${resource} not found` });
}

/**
 * @param {Response} res
 * @param {string} message
 * @returns {Response}
 */
function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

/**
 * @param {Response} res
 * @param {Error|unknown} err
 * @returns {Response}
 */
function serverError(res, err) {
  console.error(err);
  const msg = err instanceof Error ? err.message : String(err);
  return res.status(500).json({ error: msg });
}

module.exports = { notFound, badRequest, serverError };
