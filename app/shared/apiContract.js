// @ts-check
'use strict';
/**
 * shared/apiContract.js
 * Type documentation for the window.api() contract.
 *
 * window.api(method, path, body?) 
 *   - Sends a JSON request to /api/v1/{path}
 *   - Returns Promise<data> — the parsed JSON body directly
 *   - Throws on HTTP errors (4xx/5xx)
 *   - NEVER returns a Response object
 *   - NEVER requires .json() or .ok checks
 *
 * This means:
 *   WRONG:  const r = await window.api('GET', '/foo'); r.json()  ← r is already data
 *   WRONG:  const r = await window.api('GET', '/foo'); r.ok      ← r has no .ok
 *   RIGHT:  const data = await window.api('GET', '/foo');
 *   RIGHT:  const data = await window.api('POST', '/foo', body);
 *
 * Error handling:
 *   try {
 *     const data = await window.api('GET', '/foo');
 *   } catch(err) {
 *     toast(ghErrorMsg(err), 'err');
 *   }
 */
module.exports = {};
