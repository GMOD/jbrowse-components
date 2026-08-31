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

export function defaultSocketPath() {
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\jbrowse-desktop-mcp-${label()}`
  }
  const dir = path.join(os.tmpdir(), `jbrowse-desktop-mcp-${label()}`)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  return path.join(dir, 'mcp.sock')
}
