# JBrowse Desktop MCP server

Lets an MCP client (Claude Desktop, Claude Code, ...) drive the running JBrowse
Desktop app: open configs and sessions, build views from session specs, navigate
to genes, add tracks from local files or URLs, and screenshot the result.

## How it fits together

- The app's main process serves a line-oriented bridge on a per-user socket
  (`socketPath.ts`); renderer-model tools relay over the typed IPC layer
  (`mcpRequest`/`mcpResponse` in `../ipc/channelTypes.ts`) to
  `src/mcp/handleMcpRequest.ts`.
- The MCP client spawns a thin stdio server (`stdioServer.ts`) that connects to
  that socket. Two interchangeable entries: the packaged app with `--mcp`, or
  `node build/mcpServer.js` (built by `pnpm build:electron-main`).

## Claude Desktop setup

Packaged app (macOS):

```json
{
  "mcpServers": {
    "jbrowse": {
      "command": "/Applications/JBrowse 2.app/Contents/MacOS/JBrowse 2",
      "args": ["--mcp"]
    }
  }
}
```

Development checkout:

```json
{
  "mcpServers": {
    "jbrowse": {
      "command": "node",
      "args": [
        "/path/to/jbrowse-components/products/jbrowse-desktop/build/mcpServer.js"
      ]
    }
  }
}
```

JBrowse Desktop itself must be running (it serves the socket); tool calls made
while it is closed return a message saying to launch it.

## Tools

The primitives come first: `evaluate` runs Claude-authored async JS against the
live session/MST model graph (with `jb` helpers: the mobx-state-tree API, config
readers, direct adapter data access, refName renaming, the readiness wait), and
`docs` serves the raw documentation (`live-model`, `session-spec`, `automating`)
— bundled at build time, readable while the app is closed.

The rest are shortcuts over the same surface: `open` (config/session/link; bare
lists recent sessions), `inspect_session` (no path: overview; path: live model
walks, getters included), `list_tracks`, `load_session_spec`, `navigate`,
`track` (show / in-place update with single/match/all selectors / hide),
`add_track`, `get_features` (main-thread adapter read of the visible region,
refNames renamed), `screenshot` — see `toolDefinitions.ts` for the contracts.
`load_session_spec` takes the same spec JSON as JBrowse Web's `&session=spec-`
URLs (website/docs/urlparams.md); `screenshot` waits on the capture readiness
contract (`[data-app-phase="ready"]`) before capturing.

`pnpm test:mcp` (after `pnpm build && pnpm build:electron-main`) launches the
built app and runs the conformance suite in `test/mcpConformance.ts` against
volvox; agent-side working discipline lives in `.claude/skills/jbrowse-mcp/`.
