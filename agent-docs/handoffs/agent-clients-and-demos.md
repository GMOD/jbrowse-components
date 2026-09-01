---
name: agent-clients-and-demos
description: What was established about driving JBrowse from a real Claude client — the Chrome extension's actual powers, the macOS automation that films it, and where the demo harness lives. The work items are rows in TODO.md; this is the knowledge behind them, which lives nowhere else.
---

# Driving JBrowse from a real Claude client

The work these findings belong to is filed:
[land-the-agent-client-demo-videos](../todo/land-the-agent-client-demo-videos.md),
[prove-window-jb-against-a-real-browser-agent](../todo/prove-window-jb-against-a-real-browser-agent.md).
This file is what was learned getting there, because every item below was a dead
end first and none of it is recorded in the tree.

Delete this when both rows land.

## What the Chrome extension actually is

- **Its tools are deferred.** A headless `claude -p --chrome` session lists only
  the built-ins until `ToolSearch` pulls `mcp__claude-in-chrome__*`. They are
  there; they are not advertised. An earlier read of the manifest concluded the
  extension had no JS eval at all, and that was wrong twice over.
- **"Claude in Chrome requires permission" was Claude Code's own allowlist**,
  not Chrome, and not a prompt anyone had to click. `--allowedTools
  mcp__claude-in-chrome` clears it and `permission_denials` goes empty. A day
  was lost to reading that message literally.
- **`javascript_tool` evaluates in the page's MAIN world.** It read
  `window.JBrowseSession` and got an object back. This is the fact the whole
  window-global approach rests on.
- **Two Chrome installs register the extension here** (stable 152, Canary 154),
  so a run must name a `deviceId` or it stops to ask.
- **GEO bigWigs fetch from the jbrowse.org origin** — 206, real bytes — so CORS
  is not the blocker there that it is for some hosts.
- The extension can read `file://` URLs if granted, and that is the whole extent
  of its local reach: no writes, no child process, no indexing.

## The macOS automation that films it

- **The terminal needs Accessibility *and* Screen Recording.** Without the
  second, `screencapture` silently returns a wallpaper-only image with no
  windows in it — which reads convincingly as "the window is on another Mission
  Control space" and is the single most expensive wrong turn here. ffmpeg's
  avfoundation capture blocks outright instead.
- **`screencapture -l <windowid>`, not `-R <region>`.** Region capture only sees
  the current space; window capture returns a clean, desktop-free image of the
  window on any space, which is also the better frame. Window ids come from
  `CGWindowListCopyWindowInfo` (a ~30-line Swift helper).
- **Input needs both mechanisms, and neither alone.** System Events cannot click
  (`-25211`), and CGEvent unicode keystrokes do not reach the panel. So CGEvent
  clicks and sends Cmd+A / Delete / Return, and System Events types.
- **Type one keystroke event per word.** A whole sentence in one event comes out
  reordered: the first take filmed "This page. isJBrowse".
- **`Cmd+E` toggles the Claude side panel**, from the extension manifest's
  `toggle-side-panel` command.
- **Dismiss the panel's account notices before filming.** One names the weekly
  usage remaining on the account being filmed.
- Chrome raises a `"Claude" started debugging this browser` infobar while the
  extension works, which changes the frame height mid-clip.

## Where the harness is

`/private/tmp/claude-501/-Users-colin-src-jbrowse-components--claude-worktrees-mcp-demo/`,
under the session scratchpads — **ephemeral**. `agentDemo.mjs` films JBrowse
Desktop while a real `claude -p` session drives it over MCP and paints captions
from the streamed messages; `panelDemo.mjs`, `inputtool.swift`,
`windowlist.swift` and `encodeBrowser.mjs` are the browser side; `run5/` holds
the encoded take, its poster and the full transcript.

**Copy anything worth keeping before that directory is wiped.** If the harness
is ever worth keeping in-tree, these findings belong in `reference/` rather than
here, and this file goes away.
