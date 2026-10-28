import path from 'node:path'

import {
  exportBooleanFlags,
  isDataFile,
  isModifier,
  launchFlags,
  launchPlan,
  launchViewType,
  parseArgv,
} from '@jbrowse/launch-args'

import { isWebUrl } from './navigationGuard.ts'

import type { LaunchPlanJson, LaunchTarget } from './ipc/channelTypes.ts'
import type { LaunchPlan } from '@jbrowse/launch-args'

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

/**
 * Whether a path carries {@link SESSION_EXTENSION}, and so is a file JBrowse
 * wrote as a session.
 *
 * Case-insensitively, which is the whole reason this is a function. Windows
 * matches a file extension without regard to case, and so does the registry
 * association the installer writes, so Explorer will hand us `Session.JBROWSE`
 * for a file a plain `endsWith` rejects; macOS's default filesystem is
 * case-insensitive too. An extension states what a file *is* rather than
 * forming part of its identity, so this folds on every platform — unlike
 * `isAutosave`, which compares two paths for identity and folds only where the
 * filesystem does.
 */
export function hasSessionExtension(filePath: string) {
  return filePath.toLowerCase().endsWith(SESSION_EXTENSION)
}

// A launch argument may be a saved session (.jbrowse) or a hand-written /
// CLI-generated config (config.json); both are JSON snapshots loaded the same
// way, and the start screen's "Open config.json or .jbrowse file" accepts the
// same pair.
//
// Only the first is registered as a file association: `.json` is every
// machine's most common config format, and claiming it would make JBrowse the
// default application for all of them.
const LAUNCH_FILE_EXTENSIONS = [SESSION_EXTENSION, '.json']

// Folded like hasSessionExtension above, and for the sharper version of the
// same reason: this predicate is what the Windows file association runs into.
// Explorer launches us for `Session.JBROWSE` because the association is
// case-insensitive, and an argument this misses is not an error — it is
// `undefined`, i.e. the start screen with nothing on it and no explanation.
function hasLaunchExtension(arg: string) {
  const lower = arg.toLowerCase()
  return LAUNCH_FILE_EXTENSIONS.some(ext => lower.endsWith(ext))
}

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
  // A jbrowse:// url arrives from anywhere that can make the OS open a link,
  // so `jbrowse://open?url=file:///…` must not turn a click into a local read
  return isWebUrl(wrapped) ? wrapped : undefined
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

/** A jbrowse:// link as the session it opens, or why it opens none. */
export function protocolTarget(input: string): ArgvTarget {
  const url = parseProtocolUrl(input)
  return url
    ? { type: 'link', url }
    : {
        type: 'invalid',
        message: `${input} is not a link JBrowse Desktop can open: it needs a ?url= naming an http(s) JBrowse Web page`,
      }
}

/**
 * What a file macOS hands over in an 'open-file' event opens as: a session or
 * config as itself, and a data file as `jbrowse-desktop <file>` would.
 */
export function openFileTarget(filePath: string): ArgvTarget | undefined {
  return hasLaunchExtension(filePath)
    ? { type: 'file', path: filePath }
    : findLaunchTarget(['', filePath], path.dirname(filePath))
}

/**
 * A launch target, or the reason a command line names none it can open. Only
 * the main process sees the reason; it reports it rather than sending it on.
 */
export type ArgvTarget = LaunchTarget | { type: 'invalid'; message: string }

const flagName = (arg: string) => arg.replace(/^-+/, '').split('=')[0] ?? ''

const isFlag = (arg: string) => arg.startsWith('-') && arg !== '-'

// Desktop's own flags, and whether each takes the argument after it
const DESKTOP_FLAGS = new Map([
  ['renderer', true],
  ['mcp', false],
])

/**
 * Splits argv into the shared launch grammar and the flags Desktop leaves out.
 *
 * - A launch flag keeps the argument after it as its value, whatever it is.
 * - A kebab-case or single-dash flag (`--no-sandbox`, macOS's `-psn_…`) is a
 *   Chromium, Electron or OS switch, which carries any value after an `=` and
 *   so takes nothing after it.
 * - Any other flag is one of jb2export's that Desktop does not take (`--width
 *   1400`, `--multiwig a.bw,b.bw`): it goes with its value and the modifiers
 *   after it, and is reported, so none of them reads as a file of its own or
 *   attaches to the entry before it. A boolean one (`--refseq`) takes only
 *   `true` or `false`.
 * - A bare config.json is the config the files open on, so `jbrowse-desktop
 *   project/config.json reads.bam` reads as `--config`.
 */
function launchArgs(args: readonly string[]) {
  const kept: string[] = []
  const ignored: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    const name = flagName(arg)
    const next = args[i + 1]
    const takesNext = !arg.includes('=') && next !== undefined && !isFlag(next)
    if (!isFlag(arg)) {
      if (arg.toLowerCase().endsWith('.json')) {
        kept.push('--config', arg)
      } else {
        kept.push(arg)
      }
    } else if (launchFlags.has(name)) {
      kept.push(arg)
      if (takesNext) {
        kept.push(next)
        i++
      }
    } else if (DESKTOP_FLAGS.has(name)) {
      if (DESKTOP_FLAGS.get(name) && takesNext) {
        i++
      }
    } else if (arg.startsWith('--') && !name.includes('-')) {
      const given = [arg]
      if (
        takesNext &&
        (!exportBooleanFlags.has(name) || next === 'true' || next === 'false')
      ) {
        given.push(next)
        i++
      }
      while (i + 1 < args.length && isModifier(args[i + 1]!)) {
        given.push(args[++i]!)
      }
      ignored.push(given.join(' '))
    }
  }
  return { kept, ignored }
}

// A command line that names what to open with the launch grammar: a data
// file, or one of its flags.
function usesLaunchGrammar(args: readonly string[]) {
  return args.some(
    a => isDataFile(a) || (a.startsWith('--') && launchFlags.has(flagName(a))),
  )
}

const asPlanJson = (plan: LaunchPlan): LaunchPlanJson => plan

/**
 * What the command line asks to open, or why it cannot be opened. On Windows
 * and Linux a jbrowse:// link is delivered as an argv entry (at first launch,
 * or via second-instance when one is already running); macOS delivers it as
 * an 'open-url' event instead.
 */
export function findLaunchTarget(
  argv: readonly string[],
  cwd: string,
): ArgvTarget | undefined {
  const args = argv.slice(1)
  // Any jbrowse:// argument is claimed here, whether or not it parses: an
  // unusable one (a rejected inner protocol, a missing url) must fail as a bad
  // link, never fall through to the file branch below where a payload like
  // `jbrowse://open?url=file:///secret.json` would be re-read as a path to open.
  const protocolArgs = args.filter(isProtocolUrl)
  if (protocolArgs.length) {
    return protocolTarget(
      protocolArgs.find(a => parseProtocolUrl(a)) ?? protocolArgs[0]!,
    )
  }
  const { kept: all, ignored } = launchArgs(args)
  const viewType = all[0] === undefined ? undefined : launchViewType(all[0])
  const kept = viewType ? all.slice(1) : all
  const session = kept.find(a => !isFlag(a) && hasSessionExtension(a))
  if (viewType || usesLaunchGrammar(args)) {
    try {
      if (session) {
        throw new Error(
          `${session} is a saved session, which opens on its own; a genome, data files and --loc open a new one`,
        )
      }
      const plan = launchPlan(parseArgv(kept), cwd, viewType)
      return {
        type: 'plan',
        plan: asPlanJson({
          ...plan,
          unapplied: [...ignored, ...plan.unapplied],
        }),
      }
    } catch (e) {
      return {
        type: 'invalid',
        message: e instanceof Error ? e.message : String(e),
      }
    }
  }
  const file = kept.find(a => !isFlag(a) && hasLaunchExtension(a))
  const stray = kept.find(a => !isFlag(a) && !hasLaunchExtension(a))
  return file
    ? { type: 'file', path: path.resolve(cwd, file) }
    : stray
      ? {
          type: 'invalid',
          message: `JBrowse Desktop cannot open ${stray}. It opens a session (.jbrowse), a config.json, a jbrowse:// link, or a genome and data files JBrowse recognizes by name (FASTA, BAM, VCF, BigWig, ...)`,
        }
      : undefined
}
