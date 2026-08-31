/**
 * What a launch of the executable should actually do. Kept free of `electron`
 * imports, like launchTarget.ts, so the decision is unit-testable without an
 * Electron runtime — the wiring in electron.ts is not.
 */

export const HELP_TEXT = `JBrowse 2 desktop

Usage: jbrowse-desktop [options] [file | jbrowse://open?url=<JBrowse Web link>]

  file          Path to a session (.jbrowse) or configuration (config.json)
                file to open on launch

Options:
  --renderer <mode>  Force a rendering backend: "webgl" or "canvas" instead of
                     auto-detecting WebGPU. Useful over X11 / remote desktops
                     where WebGPU is unavailable.
  --mcp              Run as an MCP stdio server that controls the running
                     JBrowse Desktop instance (for Claude Desktop and other
                     MCP clients); opens no window of its own
  -h, --help         Print this help message and exit
  --version          Print the version number and exit

Documentation: https://jbrowse.org/jb2/docs/`

// Text to print for an informational flag (--version/--help), or undefined when
// the app should launch normally.
export function cliInfoOutput(argv: readonly string[], version: string) {
  const args = argv.slice(1)
  return args.includes('--version')
    ? version
    : args.includes('--help') || args.includes('-h')
      ? HELP_TEXT
      : undefined
}

export type LaunchMode =
  | { type: 'info'; output: string }
  | { type: 'mcp' }
  | { type: 'run' }
  | { type: 'duplicate' }

/**
 * The three ways a launch can end, and the order they are decided in.
 *
 * `duplicate` is the one with teeth. Everything the app owns under `userData` —
 * recent_sessions.json, the autosaves, thumbnails, globalPlugins.json — is
 * rewritten whole, and every defense around those writes is in-process:
 * sessionHandlers' `serializeRecentSessions` is one promise chain, and its
 * `lastSave`/`lastThumbnail` slots assume one session is open at a time.
 * writeFileAtomic makes a *reader* see whole-old or whole-new, which is not the
 * same as surviving a concurrent writer: two instances would each read the same
 * recent-sessions list and each write its own, and the later rename silently
 * drops the other's rows. So a second instance must not run. It forwards its
 * argv through the app's `second-instance` listener and exits. GMOD/2478.
 *
 * `acquireSingleInstanceLock` is a parameter rather than a direct
 * `app.requestSingleInstanceLock()` call because *not* calling it is half of
 * what this function guarantees. Acquiring the lock is how a launch announces
 * itself to the running instance, and that instance answers by raising its
 * window and opening whatever the argv named. `jbrowse-desktop --version` must
 * print a string to a terminal and disturb nothing, so the info check has to
 * come first — the lock is never reached on that path.
 */
export function resolveLaunchMode(
  argv: readonly string[],
  version: string,
  acquireSingleInstanceLock: () => boolean,
): LaunchMode {
  const output = cliInfoOutput(argv, version)
  // `--mcp`, like the info flags, must never touch the lock: it talks to the
  // running instance over its bridge socket rather than becoming one, and
  // acquiring the lock would raise that instance's window on every MCP client
  // startup
  return output !== undefined
    ? { type: 'info', output }
    : argv.slice(1).includes('--mcp')
      ? { type: 'mcp' }
      : acquireSingleInstanceLock()
        ? { type: 'run' }
        : { type: 'duplicate' }
}
