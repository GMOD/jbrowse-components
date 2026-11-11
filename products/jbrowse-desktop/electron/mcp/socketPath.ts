import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Where the running app and the stdio shim meet. Deliberately NOT under
// userData: the shim runs as plain node (or as `--mcp` before app 'ready') and
// cannot ask Electron where userData is, so the rendezvous has to be computable
// from node alone.
//
// The candidate directories, in order:
// - on Linux, the per-user runtime directory — $XDG_RUNTIME_DIR, then
//   /run/user/<uid> when it exists, which is where logind puts it and so is
//   found even by a shim an MCP client spawned with a scrubbed environment.
//   Nobody else can plant anything there.
// - the per-user directory under tmpdir, where only the ownership test in
//   `socketDirStatus` keeps out one another account planted on a shared /tmp.
//
// The app serves the first candidate. The shim walks all of them in order,
// refusing an unsafe one, and talks to the first that answers — so a shim that
// sees a runtime directory the app did not still reaches it under tmpdir, and
// the one disagreement left (an app whose $XDG_RUNTIME_DIR is not
// /run/user/<uid>, behind a shim that cannot see it) ends in a message naming
// every path it tried, not in a connection to the wrong place.
function label() {
  return os.userInfo().username.replaceAll(/[^\w.-]+/g, '_')
}

function tmpSocketDir() {
  return path.join(os.tmpdir(), `jbrowse-desktop-mcp-${label()}`)
}

function runtimeSocketDirs() {
  const logind = `/run/user/${process.getuid?.()}`
  const runtimeDirs =
    process.platform === 'linux'
      ? [process.env.XDG_RUNTIME_DIR, fs.existsSync(logind) ? logind : '']
      : []
  return runtimeDirs.flatMap(dir =>
    dir && path.isAbsolute(dir) ? [path.join(dir, 'jbrowse-desktop-mcp')] : [],
  )
}

export function socketDirs() {
  return [...new Set([...runtimeSocketDirs(), tmpSocketDir()])]
}

/**
 * The shim's candidates, in the order it tries them. Pure, like
 * `defaultSocketPath`: only the app creates a directory.
 */
export function socketPaths() {
  return process.platform === 'win32'
    ? [defaultSocketPath()]
    : socketDirs().map(dir => path.join(dir, 'mcp.sock'))
}

/**
 * Where the app listens, and nothing else. Pure so that every consumer can name
 * it: only the app creates the directory.
 */
export function defaultSocketPath() {
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\jbrowse-desktop-mcp-${label()}`
    : path.join(runtimeSocketDirs()[0] ?? tmpSocketDir(), 'mcp.sock')
}

function unsafeBecause(stat: fs.Stats) {
  const uid = process.getuid?.()
  return stat.isSymbolicLink()
    ? 'is a symbolic link'
    : !stat.isDirectory()
      ? 'is not a directory'
      : stat.uid !== uid
        ? `belongs to uid ${stat.uid}, not this account (uid ${uid})`
        : (stat.mode & 0o077) !== 0
          ? `has mode ${(stat.mode & 0o777).toString(8).padStart(4, '0')}, which lets other accounts in`
          : undefined
}

/**
 * The one test of a socket directory, shared by the app before it listens and
 * the shim before it connects: undefined when the directory is absent, else
 * why it is unsafe, if it is. On a shared /tmp a directory another account
 * planted would otherwise own the rendezvous for an endpoint that runs
 * arbitrary code — the agent's code would go to them and their answers come
 * back as JBrowse's.
 */
export function socketDirStatus(dir: string) {
  const stat = fs.lstatSync(dir, { throwIfNoEntry: false })
  const reason = stat && unsafeBecause(stat)
  return (
    stat && {
      unsafe: reason
        ? `The MCP socket directory ${dir} ${reason}; it must be a directory this account owns, with mode 0700.`
        : undefined,
    }
  )
}

/**
 * Create the socket directory, refusing one this account does not exclusively
 * own. Created only when absent, because `mkdirSync`'s mode applies only then.
 */
export function ensureSocketDir(dir: string) {
  if (!socketDirStatus(dir)) {
    fs.mkdirSync(dir, { mode: 0o700 })
  }
  const unsafe = socketDirStatus(dir)?.unsafe
  if (unsafe) {
    throw new Error(unsafe)
  }
}
