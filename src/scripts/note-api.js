/** @param {Response} response @param {string} action */
export async function readApiResponse(response, action) {
  const body = await response.text();
  const contentType = response.headers.get('content-type') || 'unknown content type';
  if (!body.trim()) {
    throw new Error(`${action}: the server returned an empty response (HTTP ${response.status}). Check that the Worker is running with npm run dev.`);
  }

  let payload;
  try { payload = JSON.parse(body); }
  catch {
    throw new Error(`${action}: expected JSON but received ${contentType} (HTTP ${response.status}). Check that this request reached the Cloudflare Worker.`);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error(`${action}: expected a JSON object but received ${contentType} (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(payload.error || `${action} failed (HTTP ${response.status}).`);
  return payload;
}
