// Which urls the main window is allowed to become, and which are safe to hand
// to the OS. Kept free of `electron` imports so it is unit-testable without an
// Electron runtime — the wiring in window.ts is not.

// The main window runs with nodeIntegration, so whatever document it holds can
// require() anything. Navigating it is therefore equivalent to granting the
// destination full access to the user's machine, and only the app's own bundle
// may ever hold it. Everything else is bounced to the real browser, which is
// also what the user wants from a link: JBrowse is a single page, so navigating
// away would silently destroy the session they are looking at.
export function isAppUrl(target: string, appUrl: string) {
  let url: URL
  let app: URL
  try {
    url = new URL(target)
    app = new URL(appUrl)
  } catch {
    return false
  }
  // Compared piecewise rather than by origin: a file:// url's origin is the
  // opaque "null", which every other file:// url shares — so an origin check
  // would let the packaged app navigate to any file on disk. Query and hash are
  // ignored because buildAppUrl varies them (?config=, ?specLink=, ?renderer=).
  return (
    url.protocol === app.protocol &&
    url.host === app.host &&
    url.pathname === app.pathname
  )
}

// shell.openExternal hands the url to the OS, which will happily launch a
// file:// path in whatever application claims it — so a page must not be able
// to open one. Only the web protocols a browser would take.
const EXTERNALLY_OPENABLE_PROTOCOLS = new Set(['http:', 'https:'])

export function isSafeExternalUrl(target: string) {
  try {
    return EXTERNALLY_OPENABLE_PROTOCOLS.has(new URL(target).protocol)
  } catch {
    return false
  }
}
