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

/**
 * Whether a redirect the auth window is following is the one the OAuth flow is
 * waiting for — the point at which the window is closed and the url (carrying
 * the authorization code) is handed back to the renderer.
 *
 * Compared as origin + path, not `startsWith`. A prefix test also accepts every
 * url that merely begins with the redirect_uri, so for the `http://localhost/auth`
 * the desktop flow registers it would have resolved on `http://localhost/authz`
 * — a different endpoint, and on a redirect chain the provider controls. The
 * query and fragment are excluded because they are where the code itself
 * arrives, so they differ by definition.
 */
export function isOAuthRedirect(target: string, redirectUri: string) {
  try {
    const url = new URL(target)
    const expected = new URL(redirectUri)
    return url.origin === expected.origin && url.pathname === expected.pathname
  } catch {
    return false
  }
}

const WEB_PROTOCOLS = new Set(['http:', 'https:'])

// A url that names a server rather than the machine. Everything else — file://,
// a custom scheme some other installed app registered — is a way to reach past
// the web from a page, so the two guards below both start here.
export function isWebUrl(target: string) {
  try {
    return WEB_PROTOCOLS.has(new URL(target).protocol)
  } catch {
    return false
  }
}

// shell.openExternal hands the url to the OS, which will happily launch a
// file:// path in whatever application claims it — so a page must not be able
// to open one.
export function isSafeExternalUrl(target: string) {
  return isWebUrl(target)
}
