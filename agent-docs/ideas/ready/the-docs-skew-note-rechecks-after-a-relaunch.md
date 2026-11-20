---
name: the-docs-skew-note-rechecks-after-a-relaunch
description: Desktop's MCP shim checks the docs version skew once for its whole life, but Claude Desktop keeps one shim across app relaunches and updates, so the note describes the first app the shim reached.
---

# The docs skew note rechecks after a relaunch

`docsSkewNote` in `products/jbrowse-desktop/electron/mcp/stdioServer.ts` sets
`skewChecked` once and never clears it. Claude Desktop keeps one shim across
app relaunches and updates, so the note describes the first app the shim
reached.

The fix: key the cached note on the app it was computed against, and recheck
when the shim reconnects to a different app.
