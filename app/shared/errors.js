/**
 * shared/errors.js
 * Standard error response helpers used by all route files.
 */
function notFound(res, resource = 'Record') {
  return res.status(404).json({ error: `${resource} not found` });
}
function badRequest(res, message) {
  return res.status(400).json({ error: message });
}
function serverError(res, err) {
  console.error(err);
  return res.status(500).json({ error: 'Internal server error', detail: err.message });
}
function forbidden(res, message = 'Forbidden') {
  return res.status(403).json({ error: message });
}
module.exports = { notFound, badRequest, serverError, forbidden };
