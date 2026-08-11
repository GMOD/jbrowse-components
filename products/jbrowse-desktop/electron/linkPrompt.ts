// How a jbrowse:// link is described in the dialog that asks whether to open
// it. Pure, so the wording is unit-testable without an Electron runtime; the
// dialog itself lives in electron.ts.

// A JBrowse Web link carries its whole session spec in the query string, so
// these are not short: the docs' own figure links run to ~7kB, and the dialog
// showed the entire thing as its detail text. That is a wall of percent-encoded
// JSON with the buttons somewhere past it, and it hides the one thing the user
// is actually deciding.
//
// The cut is at 200 characters because that is what it takes to reach past the
// `config=` parameter on a real figure link — origin, path and config are the
// informative prefix, and everything after it is spec payload.
const MAX_DISPLAY_LENGTH = 200

export interface LinkDescription {
  // the link's origin, when it has one — what the user is really being asked to
  // trust. Undefined for a url that doesn't parse, which the caller words around
  // rather than showing "null".
  origin: string | undefined
  // the link, shortened for display
  displayUrl: string
}

/**
 * Describe a JBrowse Web link for the confirmation dialog.
 *
 * Deliberately does no session parsing. Reproducing parseSessionSpecUrl's
 * config resolution here would put a second, drifting copy of it in the main
 * process — which cannot import the real one — for the sake of dialog text. The
 * truncated prefix already shows `config=`, and the plugins that config declares
 * get their own trust prompt later (ADR-038).
 */
export function describeLaunchLink(url: string): LinkDescription {
  let origin: string | undefined
  try {
    origin = new URL(url).origin
  } catch {
    origin = undefined
  }
  return {
    origin,
    displayUrl:
      url.length > MAX_DISPLAY_LENGTH
        ? `${url.slice(0, MAX_DISPLAY_LENGTH)}…\n\n(${url.length} characters in all; the rest is the session this link describes)`
        : url,
  }
}
