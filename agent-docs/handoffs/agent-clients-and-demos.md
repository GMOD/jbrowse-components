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

In the tree, at [`scripts/agent-demos/`](../../scripts/agent-demos/CLAUDE.md),
which carries its own operating notes — it was rescued out of an ephemeral
scratchpad rather than rewritten, so the takes it produced are reproducible.

The one desktop take that exists is at
`website/static/media/mcp/agent_demo.mp4` (gitignored; bytes reach the store
through `figures:push` once the clip is approved), and its transcript is beside
the harness.

When both TODO rows land, fold whatever is still true above into
`reference/` beside the harness and delete this file.
