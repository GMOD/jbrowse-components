// The jbrowse:// link that opens a JBrowse Web view in Desktop, wrapped by the
// pages that offer one (the docs' figures, JBrowse Web's Share dialog) and
// unwrapped by Desktop's protocol handler and its "Open JBrowse Web link..."
// dialog. A leaf with no imports, so Desktop's main process and the website's
// node scripts can take it as well as the renderer.

export const JBROWSE_PROTOCOL = 'jbrowse'

/**
 * Wrap a JBrowse Web url as the jbrowse:// link that opens it in Desktop. The
 * whole url is carried as one encoded parameter (rather than copying its
 * query), so a config relative to the web instance still resolves against it.
 */
export function toProtocolUrl(webUrl: string) {
  return `${JBROWSE_PROTOCOL}://open?url=${encodeURIComponent(webUrl)}`
}

function parseUrl(input: string) {
  try {
    return new URL(input)
  } catch {
    return undefined
  }
}

/**
 * The JBrowse Web url a jbrowse:// link carries, or undefined if this isn't a
 * usable one. Never throws: it is fed unvalidated input from the OS.
 *
 * Only an http(s) url comes out. A jbrowse:// link arrives from anywhere that
 * can make the OS open one, so `jbrowse://open?url=file:///…` must not turn a
 * click into a local read, and one unwrap is all there is.
 *
 * The `open` in `jbrowse://open?url=…` is **not read**. It sits in the slot a
 * hostname would occupy, and there is no host — the link is handled locally —
 * so it is a word that reads as a command, by the convention of `vscode://file/…`
 * and friends. `jbrowse://anything?url=…` is accepted identically.
 *
 * Checking it is not worth it, because the word lands in a different property
 * depending on which of the two valid forms the caller wrote:
 * `jbrowse://open?…` puts it in `host`, `jbrowse:open?…` (no authority) puts it
 * in `pathname`. So a **second action belongs in a query param**, not here —
 * `?action=import` is read the same way from both forms, and this one is already
 * `?url=`-shaped. Adding `jbrowse://import?…` instead would be silently opened
 * as a session by every Desktop already installed, which is the failure this
 * note exists to prevent.
 */
export function parseProtocolUrl(input: string) {
  const url = parseUrl(input)
  const wrapped =
    url?.protocol === `${JBROWSE_PROTOCOL}:`
      ? url.searchParams.get('url')
      : undefined
  return wrapped && isWebUrl(wrapped) ? wrapped : undefined
}

export function isWebUrl(input: string) {
  const protocol = parseUrl(input)?.protocol
  return protocol === 'http:' || protocol === 'https:'
}
