// How a jbrowse:// link is described in the dialog that asks whether to open
// it. Pure, so the wording is unit-testable without an Electron runtime; the
// dialog itself lives in electron.ts.

// A JBrowse Web link carries its whole session spec in the query string, so
// these are not short: the docs' own figure links run to ~7kB, and the dialog
// showed the entire thing as its detail text. That is a wall of percent-encoded
// JSON with the buttons somewhere past it, and it hides the one thing the user
// is actually deciding.
const MAX_DISPLAY_LENGTH = 200

interface LinkDescription {
  // the config the link builds its session on, which is what the user is asked
  // to trust. Not the page the link points at: any link can name any page, and
  // one carrying its own data never contacts it.
  configUrl: string | undefined
  // its origin, for the dialog to lead with
  origin: string | undefined
  // the link, shortened for display
  displayUrl: string
}

// a link keeps its params in the hash when the hash holds any, as JBrowse Web
// reads them (app-core's queryParams)
function linkParams(url: URL) {
  return new URLSearchParams(
    url.hash.includes('=') ? url.hash.slice(1) : url.search,
  )
}

/**
 * The config a JBrowse Web link builds its session on, as the renderer's
 * launchFromLink resolves it; linkConfigUrl.test.ts holds the two together.
 *
 * - `config=` resolves against the page, and `config=none` names none
 * - a spec or `&loc=` link without one names none
 * - a whole-session link without one uses its page's config.json
 * - a link to a .json file is that config
 */
export function linkConfigUrl(url: URL) {
  const params = linkParams(url)
  const config = params.get('config')
  const session = params.get('session')
  return config === 'none'
    ? undefined
    : config
      ? new URL(config, url).href
      : session && !session.startsWith('spec-')
        ? new URL('config.json', url).href
        : !session && url.pathname.endsWith('.json')
          ? url.href
          : undefined
}

function parseUrl(input: string) {
  try {
    return new URL(input)
  } catch {
    return undefined
  }
}

/**
 * Describe a JBrowse Web link for the confirmation dialog. The plugins its
 * config declares get their own trust prompt later (ADR-038).
 */
export function describeLaunchLink(link: string): LinkDescription {
  const url = parseUrl(link)
  const configUrl = url ? linkConfigUrl(url) : undefined
  return {
    configUrl,
    origin: configUrl ? new URL(configUrl).origin : undefined,
    displayUrl:
      link.length > MAX_DISPLAY_LENGTH
        ? `${link.slice(0, MAX_DISPLAY_LENGTH)}…\n\n(${link.length} characters in all; the rest is the session this link describes)`
        : link,
  }
}
