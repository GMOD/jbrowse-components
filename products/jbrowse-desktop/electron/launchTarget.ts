import path from 'node:path'

import type { LaunchTarget } from './ipc/channelTypes.ts'

// Parses what a launch (argv, an OS open-file, or a jbrowse:// link) asks the
// app to open. Kept free of `electron` imports so the parsing below is
// unit-testable without an Electron runtime — the wiring in electron.ts is not.
//
// LaunchTarget itself lives in channelTypes.ts because it also crosses to the
// renderer; re-exported here, where it is produced, so callers keep one import
// site.
export type { LaunchTarget }

export const JBROWSE_PROTOCOL = 'jbrowse'

/**
 * The extension "Save session as..." forces, and with it the one reliable mark
 * of a file JBrowse wrote as a session rather than one the user brought — see
 * `isSessionFile` in paths.ts.
 *
 * Here rather than there because the packaging scripts need it too, to register
 * the file association, and paths.ts imports `electron`. It belongs next to
 * LAUNCH_FILE_EXTENSIONS in any case: this is the extension the OS is told to
 * hand us, and that list is what we accept when it does.
 */
export const SESSION_EXTENSION = '.jbrowse'

// A launch argument may be a saved session (.jbrowse) or a hand-written /
// CLI-generated config (config.json); both are JSON snapshots loaded the same
// way, and the start screen's "Open config.json or .jbrowse file" accepts the
// same pair.
//
// Only the first is registered as a file association: `.json` is every
// machine's most common config format, and claiming it would make JBrowse the
// default application for all of them.
const LAUNCH_FILE_EXTENSIONS = [SESSION_EXTENSION, '.json']

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
 *
 * The `open` in `jbrowse://open?url=…` is **not read**. It sits in the slot a
 * hostname would occupy, and there is no host — the link is handled locally —
 * so it is a word that reads as a command, by the convention of `vscode://file/…`
 * and friends. `jbrowse://anything?url=…` is accepted identically.
 *
 * Checking it is not worth it, because the word lands in a different property
 * depending on which of the two valid forms the caller wrote:
 * `jbrowse://open?…` puts it in `host`, `jbrowse:open?…` (no authority, which
 * isProtocolUrl below deliberately accepts) puts it in `pathname`. So a **second
 * action belongs in a query param**, not here — `?action=import` is read the
 * same way from both forms, and this one is already `?url=`-shaped. Adding
 * `jbrowse://import?…` instead would be silently opened as a session by every
 * Desktop already installed, which is the failure this note exists to prevent.
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
//
// Matched on the bare scheme, not `jbrowse://`: `jbrowse:open?url=…` (no
// authority) is an equally valid URI that parseProtocolUrl reads fine, and
// Windows/Linux hand the link to argv verbatim (`"%1"` from the NSIS registry
// key, `%U` from the .desktop file). A form this predicate misses is not
// rejected — it falls through to the file branch below, where path.resolve on a
// payload like `jbrowse:x/../../../Downloads/evil.jbrowse` climbs back out to an
// arbitrary local config, opened with neither the link confirmation prompt nor
// the plugin-trust gate a remote config gets.
function isProtocolUrl(arg: string) {
  return arg.toLowerCase().startsWith(`${JBROWSE_PROTOCOL}:`)
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
