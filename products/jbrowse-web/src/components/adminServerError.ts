// Longest response body worth putting in a snackbar. An admin server that means
// to explain itself does so in a sentence or a small JSON object; anything past
// this is a document, and a toast is not where a document gets read.
const MAX_DETAIL = 200

// A body that opens as markup. The POST that fails is usually answered by
// something that is not the admin server at all — a static file server's 404
// page, a proxy's 502, a login portal — and every one of those replies with a
// whole HTML document.
const MARKUP = /^\s*<(?:!doctype|html|head|body|\?xml)\b/i

/**
 * The snackbar text for an admin-server POST that came back not-ok.
 *
 * The status is the part an admin can act on, so it leads and is never crowded
 * out. The body follows only when it reads as an explanation: served unabridged
 * it was a screen of stylesheet with `404` somewhere inside it, because the
 * thing answering `/updateConfig` on a site with no admin server running is the
 * static file server, and its 404 is a styled HTML page.
 */
export function adminServerErrorMessage(
  status: number,
  statusText: string,
  body: string,
) {
  const head = `HTTP ${status}${statusText ? ` ${statusText}` : ''}`
  const trimmed = body.trim()
  if (!trimmed || MARKUP.test(trimmed)) {
    return head
  }
  const detail =
    trimmed.length > MAX_DETAIL ? `${trimmed.slice(0, MAX_DETAIL)}…` : trimmed
  // Collapsed: a multi-line body (a stack trace, a wrapped JSON dump) otherwise
  // sets the snackbar's height from its own line count rather than from how much
  // there is to read.
  return `${head} — ${detail.replaceAll(/\s+/g, ' ')}`
}
