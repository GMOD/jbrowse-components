import path from 'node:path'

// What a launch (argv, an OS open-file, or a jbrowse:// link) asks the app to
// open. Kept free of `electron` imports so the parsing below is unit-testable
// without an Electron runtime — the wiring in electron.ts is not.

export type LaunchTarget =
  | { type: 'file'; path: string }
  // a JBrowse Web https link, unwrapped from a jbrowse:// url
  | { type: 'link'; url: string }

export const JBROWSE_PROTOCOL = 'jbrowse'

// A launch argument may be a saved session (.jbrowse) or a hand-written /
// CLI-generated config (config.json); both are JSON snapshots loaded the same
// way, and the start screen's "Open config.json or .jbrowse file" accepts the
// same pair.
const LAUNCH_FILE_EXTENSIONS = ['.jbrowse', '.json']

// Only ever wrap a web link. A jbrowse:// url arrives from anywhere that can
// make the OS open a link (any web page), so the wrapped url is restricted to
// http(s): without this, `jbrowse://open?url=file:///…` would turn a link click
// into a local-file read.
const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:'])

/**
 * Wrap a JBrowse Web url as the jbrowse:// link that opens it in Desktop. The
 * whole url is carried as one encoded parameter (rather than copying its
 * query), so a config relative to the web instance still resolves against it.
 */
export function toProtocolUrl(webUrl: string) {
  return `${JBROWSE_PROTOCOL}://open?url=${encodeURIComponent(webUrl)}`
}

/**
 * The JBrowse Web url a jbrowse:// link carries, or undefined if this isn't a
 * usable one. Never throws: it is fed unvalidated input from the OS.
 */
export function parseProtocolUrl(input: string): string | undefined {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return undefined
  }
  if (url.protocol !== `${JBROWSE_PROTOCOL}:`) {
    return undefined
  }
  const wrapped = url.searchParams.get('url')
  if (!wrapped) {
    return undefined
  }
  try {
    return ALLOWED_LINK_PROTOCOLS.has(new URL(wrapped).protocol)
      ? wrapped
      : undefined
  } catch {
    return undefined
  }
}

// URL schemes are case-insensitive, and Windows hands the link back with
// whatever casing the caller wrote, so match the scheme without regard to case.
export function isProtocolUrl(arg: string) {
  return arg.toLowerCase().startsWith(`${JBROWSE_PROTOCOL}://`)
}

/**
 * What the command line asks to open. On Windows and Linux a jbrowse:// link
 * is delivered as an argv entry (at first launch, or via second-instance when
 * one is already running); macOS delivers it as an 'open-url' event instead.
 */
export function findLaunchTarget(
  argv: readonly string[],
  cwd: string,
): LaunchTarget | undefined {
  const args = argv.slice(1)
  // Any jbrowse:// argument is claimed here, whether or not it parses: an
  // unusable one (a rejected inner protocol, a missing url) must fail as a bad
  // link, never fall through to the file branch below where a payload like
  // `jbrowse://open?url=file:///secret.json` would be re-read as a path to open.
  const protocolArgs = args.filter(isProtocolUrl)
  if (protocolArgs.length) {
    const url = protocolArgs.map(parseProtocolUrl).find(Boolean)
    return url ? { type: 'link', url } : undefined
  }
  const file = args.find(a =>
    LAUNCH_FILE_EXTENSIONS.some(ext => a.endsWith(ext)),
  )
  return file ? { type: 'file', path: path.resolve(cwd, file) } : undefined
}
