import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Where the running app and the stdio shim meet. Deliberately NOT under
// userData: the shim runs as plain node (or as `--mcp` before app 'ready') and
// cannot ask Electron where userData is, so the rendezvous has to be computable
// from node alone, identically on both sides. tmpdir is per-user on macOS; the
// username suffix covers shared /tmp on Linux, and the 0o700 directory keeps
// other accounts out there too.
function label() {
  return os.userInfo().username.replaceAll(/[^\w.-]+/g, '_')
}

function socketDir() {
  return path.join(os.tmpdir(), `jbrowse-desktop-mcp-${label()}`)
}

/**
 * The rendezvous path, and nothing else. Pure so that every consumer can name
 * it: only the app creates the directory, and a shim that merely wants to
 * connect must not be able to throw over its permissions — an absent directory
 * already reports as a failed connection, which is the honest error there.
 */
export function defaultSocketPath() {
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\jbrowse-desktop-mcp-${label()}`
  }
  return path.join(socketDir(), 'mcp.sock')
}

/**
 * Create the socket directory, refusing one this account does not exclusively
 * own. `mkdirSync`'s mode applies only when it creates, so on a shared /tmp a
 * pre-existing directory another account planted would otherwise let them own
 * the rendezvous for an endpoint that runs arbitrary code.
 */
export function ensureSocketDir() {
  if (process.platform === 'win32') {
    return
  }
  const dir = socketDir()
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const stat = fs.lstatSync(dir)
  if (
    !stat.isDirectory() ||
    stat.uid !== process.getuid?.() ||
    (stat.mode & 0o077) !== 0
  ) {
    throw new Error(
      `refusing unsafe MCP socket directory ${dir}: it must be a directory owned by you with mode 0700`,
    )
  }
}
