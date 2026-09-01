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

Deliberately four. `run_javascript` is the interface: Claude-authored async JS
against the live session/MST model graph, with `jb` as the standard library
(orientation, track catalog, declarative view specs, in-place display settings
with slot routing, main-thread feature access with refName renaming, the
readiness wait, and the full mobx-state-tree/mobx APIs underneath). Every
correctness rule lives in `jb`, not in tool plumbing.

The other three exist only because renderer JavaScript cannot express them:
`screenshot` (pixels live in the main process; waits on the capture readiness
contract and reports the session's error notifications), `open` (recovery path
that works with no session or a broken renderer; waits for the new session
identity before answering; bare form lists recent sessions), and `docs`
(`live-model`, `session-spec`, `automating` — bundled at build time, readable
while the app is closed).

`pnpm test:mcp` (after `pnpm build && pnpm build:electron-main`) launches the
built app and runs the conformance suite in `test/mcpConformance.ts` against
volvox; agent-side working discipline lives in `.claude/skills/jbrowse-mcp/`
and, condensed, in the initialize response's `instructions`.
