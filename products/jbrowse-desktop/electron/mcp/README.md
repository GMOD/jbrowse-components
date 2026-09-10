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

## Threat model

`run_javascript` is arbitrary code execution in a renderer with Node access —
deliberately. The guard is the transport, not the payload: the bridge socket
lives in a directory the app refuses unless it is owned by the current user with
mode 0700, so only processes already running as that user can connect — and any
such process already holds the same privileges the socket grants. The endpoint
adds convenience, not escalation (the same argument as Chrome's DevTools
debugging port).

What that argument does NOT cover: a prompt-injected agent is a confused deputy
— a hostile dataset description or web page can ask the agent to run malicious
code, and the server cannot tell good JavaScript from bad. The mitigations are
the MCP client's per-call approval prompts and the user's judgment, the same
contract as any code-executing agent tool. Deployments that want no such
endpoint at all (shared workstations, kiosks) can set `JBROWSE_DISABLE_MCP=1`.
On Windows the named pipe relies on the default pipe security descriptor;
multi-user terminal-server setups should verify or disable.

**This design must never be ported to jbrowse-web or any network-reachable
product.** It is safe because of where it runs: a user-only local socket in a
desktop app. The same surface behind anything reachable from a browser or a
network is an RCE.

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
while it is closed return a message saying to launch it. **Help, Connect an AI
agent...** in the app shows both forms above for the running install, with a
copy button for each (`mcp/clientConfig.ts`).

## Tools

Deliberately four. `run_javascript` is the interface: Claude-authored async JS
against the live session/MST model graph, with `jb` as the standard library
(orientation, track catalog, declarative view specs, in-place display settings
with slot routing, main-thread feature access with refName renaming, the
readiness wait, and the full mobx-state-tree/mobx APIs underneath). Every
correctness rule lives in `jb`, not in tool plumbing. The envelope is what a
shell would give: the value, `logs` (the code's console output, bounded by the
same envelope budget as the value), the session's `notifications` since the
previous call (each delivered once, with its level), and on a throw the line and
column in the submitted code plus the output printed before it. A call outliving
`timeoutMs` answers with that and keeps running with its `signal` argument
aborted; the bridge budgets its relay from the same number.

The other three exist only because renderer JavaScript cannot express them:
`screenshot` (pixels live in the main process; waits on the capture readiness
contract and reports the session's error notifications; one image pixel per CSS
pixel whatever the display's density, so the two capture routes and every
machine agree), `open` (recovery path that works with no session or a broken
renderer; waits for the new session identity before answering; bare form lists
recent sessions), and `docs` (`live-model`, `recipes`, `hosted-data`,
`session-spec`, `automating`, plus `model:<Name>` / `config:<Name>` for every
documented type, compact pages `pnpm autogen` writes to
`docs/typeDocs.generated.json` from the same pass as the website reference —
bundled at build time, readable while the app is closed; a long topic answers
with its headings and takes a `section`). The bundled docs match the packaged
`--mcp` entry by construction; the standalone shim asks the running app its
version and prefixes every docs answer with a note when they disagree
(`versionSkewNote`).

Each tool also carries MCP `annotations` — `readOnlyHint` and the rest — which a
client reads to decide how hard to ask before running one. They are not shown to
the model and so are not capped like the descriptions below.

## Cancelling

`notifications/cancelled` is the one notification the stdio server acts on. The
client stops waiting; per spec the request then gets no response at all, so
`respond` drops it. The app is told separately, because the submitted code is
only ever cooperative: the cancel names the bridge's own id for the call, the
bridge maps it back to the relay it pushed, and the renderer aborts that
evaluation's `signal`. Without it an interrupted agent left its code running for
the rest of `timeoutMs` in a renderer nobody was watching.

The abort also stops the call WAITING, which is what frees the relay slot. A
cancel that lands before the race is armed — during the re-export import — is
caught by the `aborted` check at the top of `runUntilHalted`; the listener alone
would never fire for it.

`pnpm test:mcp` (after `pnpm build && pnpm build:electron-main`) launches the
built app and runs the conformance suite in `test/mcpConformance.ts` against
volvox; agent-side working discipline lives in `.claude/skills/jbrowse-mcp/`
and, condensed, in the initialize response's `instructions`.

## What each client shows the model

Claude Code cuts the server `instructions` and each tool description at 2048
characters, appending "… [truncated]":

- Changelog, 2.1.84 (2026-03): "MCP tool descriptions and server instructions
  are now capped at 2KB to prevent OpenAPI-generated servers from bloating
  context" — https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
- Reproduced on 2.1.266 (2026-09-09): with `--debug`, the log reads
  `Server instructions truncated from 3048 to 2048 chars` and
  `Tool "noop" description truncated from 3048 to 2048 chars`.
  `pnpm check-mcp-text-caps --probe` repeats that against the installed
  `claude`, for when the client changes.
- The Claude Code docs (https://code.claude.com/docs/en/mcp) do not state the
  cap; the changelog and the observed behaviour are the sources.

Claude Desktop stores the `instructions` and never shows them to the model
(https://github.com/anthropics/claude-ai-mcp/issues/93, triaged and open;
https://github.com/anthropics/claude-code/issues/43749 is the same report), so
there the description of `run_javascript` is the whole briefing until the agent
calls `docs`.

So both texts stay under the cap with the must-read sentence first
(`CLIENT_TEXT_CAP_CHARS`; `pnpm check-mcp-text-caps` fails the lint job in
push.yml when either grows past it, and `docsRoster.test.ts` runs the same check
— before it existed they had drifted to 2.7 KB and 5 KB). The stdio server also
appends the instructions to the first `run_javascript` result of a session that
has not read `docs topic:"live-model"`, after the value so `content[0]` stays
the value every caller parses. It cannot see chat boundaries, so a pause of
`SESSION_GAP_MS` since the previous call counts as a new session.
