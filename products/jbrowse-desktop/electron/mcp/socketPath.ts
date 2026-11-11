import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Where the running app and the stdio shim meet. Deliberately NOT under
// userData: the shim runs as plain node (or as `--mcp` before app 'ready') and
// cannot ask Electron where userData is, so the rendezvous has to be computable
// from node alone.
//
// The candidate directories, in order:
// - on Linux, logind's per-user runtime directory /run/user/<uid>, taken only
//   when it passes the ownership test below. Named from the uid alone and not
//   from $XDG_RUNTIME_DIR, which an MCP client strips from the shim's
//   environment: the app and the shim then build the same list.
// - the per-user directory under tmpdir, where the same test keeps out one
//   another account planted on a shared /tmp.
//
// The app serves the first candidate. The shim walks all of them and connects
// only inside a directory it has just seen pass the test — never into one that
// was absent a moment ago, which another account could create in between.
function label() {
  return os.userInfo().username.replaceAll(/[^\w.-]+/g, '_')
}

function tmpSocketDir() {
  return path.join(os.tmpdir(), `jbrowse-desktop-mcp-${label()}`)
}

function logindRuntimeDir() {
  return `/run/user/${process.getuid?.()}`
}

export function socketDirs(runtimeDir = logindRuntimeDir()) {
  const runtime = process.platform === 'linux' && socketDirStatus(runtimeDir)
  return [
    ...(runtime && !runtime.unsafe
      ? [path.join(runtimeDir, 'jbrowse-desktop-mcp')]
      : []),
    tmpSocketDir(),
  ]
}

/**
 * The shim's candidates, in the order it tries them. Pure, like
 * `defaultSocketPath`: only the app creates a directory.
 */
export function socketPaths(runtimeDir?: string) {
  return process.platform === 'win32'
    ? [defaultSocketPath()]
    : socketDirs(runtimeDir).map(dir => path.join(dir, 'mcp.sock'))
}

/**
 * Where the app listens, and nothing else. Pure so that every consumer can name
 * it: only the app creates the directory.
 */
export function defaultSocketPath(runtimeDir?: string) {
  return process.platform === 'win32'
    ? `\\\\.\\pipe\\jbrowse-desktop-mcp-${label()}`
    : path.join(socketDirs(runtimeDir)[0]!, 'mcp.sock')
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
