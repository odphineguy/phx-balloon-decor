/**
 * Streamed-response heartbeat for slow work (gpt-image-2 renders run 56–115s).
 * Vercel's proxy/intermediaries sever connections that have produced NO
 * response bytes for ~60s regardless of maxDuration, so once fast validation
 * has passed we commit to a 200 and emit a whitespace byte every few seconds
 * until the real JSON payload is ready. Leading whitespace is valid JSON, so
 * fetch().json() on the client parses the final body unchanged. Consequence:
 * post-validation failures arrive as 200 + { success: false, error } — the
 * frontend already branches on data.success.
 */
export function startHeartbeat(res, intervalMs = 5000) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.write(' ');
  const timer = setInterval(() => {
    res.write(' ');
  }, intervalMs);

  const finish = (payload) => {
    clearInterval(timer);
    res.end(JSON.stringify(payload));
  };

  return {
    succeed: (payload) => finish({ success: true, ...payload }),
    fail: (message) => finish({ success: false, error: message })
  };
}
