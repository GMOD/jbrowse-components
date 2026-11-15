---
name: mcp-socket-on-macos-ignores-a-stripped-tmpdir
description: On macOS an MCP client built on the TypeScript SDK spawns Desktop's shim without TMPDIR, so the shim looks under /tmp while the app serves under /var/folders, and the README's Claude Desktop setup cannot connect. Fix before the next Desktop release.
metadata:
  area: desktop-mcp
  category: ready
  order: 1
  first_move: "serve under a home-derived directory on darwin in `socketDirs` (`products/jbrowse-desktop/electron/mcp/socketPath.ts`), keeping tmpdir as the shim's fallback, then connect from Claude Desktop on a Mac"
---

# The MCP socket on macOS ignores a stripped TMPDIR

The app and the shim both derive the socket directory from `os.tmpdir()`
(`products/jbrowse-desktop/electron/mcp/socketPath.ts`), which is `$TMPDIR`
or else `/tmp`. A Finder-launched app gets `TMPDIR=/var/folders/…` from
launchd.

The MCP TypeScript SDK's `StdioClientTransport` spawns a server with
`getDefaultEnvironment()`, which on every non-Windows platform keeps only
`HOME`, `LOGNAME`, `PATH`, `SHELL`, `TERM` and `USER`
(`DEFAULT_INHERITED_ENV_VARS` in `@modelcontextprotocol/sdk`
`dist/cjs/client/stdio.js`, read at 1.31.0 on 2026-11-15). So the shim under
any client on that transport computes `/tmp/jbrowse-desktop-mcp-<user>`, the
app serves under `/var/folders/…`, and the shim tells the client to launch an
app that is already running. Whether Claude Desktop uses that transport is
unchecked; any client that does fails the same way.

Linux is unaffected: `/run/user/<uid>` is named from the uid, and a desktop
session rarely sets `TMPDIR` for the app either. Windows uses a named pipe.

## The fix

A darwin candidate derived from `os.homedir()` (`HOME` survives the strip),
served first by the app and tried first by the shim, through the same
ownership and mode test `socketDirStatus` applies today. macOS caps a socket
path at 104 bytes, so keep the directory short.

## Done when

On a Mac, Claude Desktop configured as the README says connects and answers a
tool call, and a test pins `socketPaths()` with `TMPDIR` unset agreeing with
`defaultSocketPath()` with it set.
