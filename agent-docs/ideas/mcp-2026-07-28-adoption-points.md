---
name: mcp-2026-07-28-adoption-points
description: The MCP 2026-07-28 spec (stateless core, no initialize handshake, official Tasks and Apps extensions) mostly targets HTTP fleets and does not motivate migrating the hand-rolled stdio server off 2025-06-18. Three points are worth acting on when client support arrives — Tasks for the long-job idiom, wherever `instructions` lands once initialize is gone, and an MCP App embedding a live view — and one known limitation is recorded here so it is not re-found.
---

# MCP 2026-07-28: what to adopt, what to ignore

The desktop MCP server speaks 2025-06-18, hand-rolled in a page of code with no
dependencies (`electron/mcp/stdioServer.ts` says why). The 2026-07-28 release
("MCP v2") makes the core stateless — the `initialize` handshake and session
ids are gone, every request self-describes in `_meta`, and OAuth is hardened —
all of which serves HTTP deployments behind load balancers and none of which
serves a local, single-user, stdio, tools-only server. Claude clients negotiate
down, and the deprecations carry a twelve-month window. **Staying put is the
decision**; these are the points to revisit as client support lands.

## Tasks: the long-job idiom, protocol-level

v2 moves Tasks to an official extension (`io.modelcontextprotocol/tasks`,
poll-based `tasks/get` / `tasks/update`). That is exactly the "park the promise
on `globalThis`, await it from a later call" discipline the docs teach for a
`run_javascript` call that outlives `timeoutMs` — today a rule in prose, which
is the one place the surface's own "correctness rules live in `jb`, not
plumbing" principle is not carried through. When Claude clients speak the
extension, adopt it; if the prose rule keeps costing turns before then, a
`jb.job(name, fn)` / `jb.jobs()` pair can own the convention in code and would
map 1:1 onto the extension later.

## Where `instructions` lands

`SERVER_INSTRUCTIONS` is delivered in the initialize response — "the one
delivery channel that reaches all clients automatically"
(`electron/mcp/toolDefinitions.ts`). v2 removes initialize; discovery moves to
an optional `server/discover`. If a client stops fetching instructions on that
path, the working discipline loses its automatic delivery and only the skill
and the tool descriptions remain. Check where instructions travel in the v2
SDKs before any migration.

## MCP Apps: a live view instead of a PNG

The Apps extension lets a server render interactive UI in the conversation.
`@jbrowse/react-app2` already embeds the whole app; an MCP App serving a live
view would replace the screenshot-and-describe loop with the thing itself. This
changes what the surface is, not how it is plumbed — spike only when client
support is broad enough to demo against.

## Recorded, not planned: notification delivery is once-globally

`undeliveredNotifications` (`packages/app-core/src/JbApi/jbApi.ts`) tracks
delivery in a module-level `WeakMap`, so two concurrent MCP clients — or an
agent plus a `window.jb` user — steal each other's toasts. Keying by consumer
needs an identity the bridge does not carry, and desktop reconstructs the `jb`
object per call, so a per-instance key re-delivers everything. Single-user
desktop makes the collision rare; this entry exists so the next reader does not
diagnose it as a lost-notification bug.
