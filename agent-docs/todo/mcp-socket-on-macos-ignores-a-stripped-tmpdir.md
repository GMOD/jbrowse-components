---
name: mcp-socket-on-macos-ignores-a-stripped-tmpdir
description: Desktop's MCP socket on macOS now lives under ~/Library/Caches so a client that strips TMPDIR still finds it; what is left is connecting from Claude Desktop on a real Mac. Fix before the next Desktop release.
metadata:
  area: desktop-mcp
  category: ready
  order: 1
  first_move: "on a Mac, configure Claude Desktop as `products/jbrowse-desktop/electron/mcp/README.md` says, launch JBrowse Desktop from Finder, and make a tool call"
---

# The MCP socket on macOS ignores a stripped TMPDIR

An MCP client on the TypeScript SDK's `StdioClientTransport` spawns the shim
with only `HOME`, `LOGNAME`, `PATH`, `SHELL`, `TERM` and `USER`, so a socket
under `$TMPDIR` put the shim under `/tmp` and the Finder-launched app under
`/var/folders/…`. `socketDirs` (`products/jbrowse-desktop/electron/mcp/socketPath.ts`)
now serves on darwin from `~/Library/Caches/jbrowse-desktop-mcp`, which both
sides name from `HOME`, and `socketPath.test.ts` pins `socketPaths()` with
`TMPDIR` unset agreeing with `defaultSocketPath()` with it set. That test fakes
darwin on Linux; no real Mac has run it.

## Done when

On a Mac, Claude Desktop configured as the README says connects and answers a
tool call.
