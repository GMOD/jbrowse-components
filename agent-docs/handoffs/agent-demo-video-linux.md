---
name: agent-demo-video-linux
description: Colin wants an automated, repeatable public video of the REAL Claude Code TUI (Sonnet, verbose) driving JBrowse Desktop side-by-side, to show people the MCP integration works. The recorder, the real-TUI driving, and the genome rendering are all solved; the one unsolved piece is automated side-by-side WINDOW TILING on GNOME/Wayland, where a program cannot position windows. The WIP harness is scripts/agent-demos/recordDemoTui.mjs.
---

# Automated agent-demo video (Linux) handoff

Colin is building a **public video that makes people comfortable the JBrowse AI
actually works**: the genuine Claude Code TUI, in a terminal, driving JBrowse
Desktop over MCP, **side by side**, with friendly narration. It must be
**automated and repeatable** — he will regenerate it over time — so no
by-hand window arranging.

Requirements he stated, in order given:
- The Claude surface is the **real Claude Code TUI**, not a formatted stream (an
  earlier take faked it by tailing `claude -p` JSON — he caught it).
- **Sonnet, not the session default** (Fable is "overpowered" for a demo):
  `claude --model sonnet`.
- **Verbose** so it shows its steps: `claude --verbose` (also a `/verbose` /
  Ctrl+O toggle in-TUI).
- **Side-by-side** windows, and **everything visible**.
- **Automated/repeatable.** This is the current blocker — see below.
- Friendly narration of what's happening (burned-in captions).

## What is DONE and works

- **The screen recorder.** `scripts/agent-demos/recorder.py` drives GNOME's own
  `org.gnome.Shell.Screencast` (whole screen → mp4, no portal dialog). The trap
  it exists for: GNOME ties the recording to the D-Bus connection that started
  it, so `gdbus call` — which exits immediately — aborts it with "Sender has
  vanished". The Python process holds one connection open for the take. Verified
  producing valid 1080p mp4s. Needs the real `:0` display (electron GPU-fatals
  under GPU-less Xvfb).
- **Driving the real TUI.** `tmux new-session` runs `claude` (a real pty, so the
  TUI renders); `tmux send-keys` types each prompt; `tmux capture-pane` reads it
  back. **Turn-done detection**: after a prompt, wait until the pane has changed
  AND then gone stable with no `esc to interrupt` line (the previous turn's
  `· done` summary lingers, so markers alone false-positive). Validated
  headlessly. `--model sonnet` and `--verbose` both confirmed to take.
- **The genome renders** (see the big finding below).
- **The first harness landed on main**: `scripts/agent-demos/recordDemoLinux.mjs`
  + `recorder.py` (commit `bd6b5ddf19`) records the whole screen while a real
  `claude -p` session drives JBrowse — but it films a *formatted stream*, which
  is the fake Colin rejected. The **WIP real-TUI harness** is
  `scripts/agent-demos/recordDemoTui.mjs` (added by this handoff, not yet
  wired to a working layout) with the curated take `takes/brca1.mjs`.

## The big finding: the "broken hg38" was a STALE BUILD, not a bug

Opening the built-in hg38 showed every RefSeq track as
`Error: Failed to load …/jbrowse-plugin-protein3d/0.9.0/… in the worker:
(0, Vs.makeStyles) is not a function`. Chased to the bottom:

- The hosted UCSC configs (`config.json` AND `minimal.json`) pin `Protein3d`
  `@latest` (0.9.0). Its UMD externalizes `tss-react/mui` (built against a core
  whose `ReExports/list` lists it) and calls `makeStyles` off the host global.
- **v5 core already provides it.** `packages/core/src/ReExports/list.ts` has
  `tss-react` and `tss-react/mui`; `modules.ts` maps them to a real `makeStyles`
  shim (`util/tss-react/`) on the main thread and `workerNamespaceNames.ts`
  gives the RPC worker a callable `makeStyles` stub. `workerModules.test.ts`
  passes, pinning exactly `import { makeStyles } from 'tss-react/mui'` reaching
  the worker ("the stub survives esbuild's namespace wrapper").
- So **nothing needs fixing in core or in the plugin** — Colin's instinct ("v5
  should just keep exporting the name tss-react") is already satisfied. The demo
  failed on a `products/jbrowse-desktop/build` that predated the worker-stub
  fixes (`f9f2b132db`, `ccb140c9f4`), the "rebuild-before-any-app-run" trap.
- **A fresh `pnpm --filter @jbrowse/desktop build` fixes it**: verified by
  opening `https://jbrowse.org/ucsc/hg38/config.json` (with protein3d) at BRCA1
  — `notReady: []`, no error notifications, RefSeq gene models drew. So the demo
  can open the **real built-in hg38**; no hand-crafted config (Colin rejected a
  hand-rolled one anyway). `recordDemoTui.mjs`'s system prompt already points at
  the built-in hg38 URL. **Always rebuild the desktop app before a take.**

## The one unsolved problem: automated side-by-side on Wayland

The session is GNOME **Wayland** (`XDG_SESSION_TYPE=wayland`). Wayland forbids a
client positioning itself and offers no scripting API to tile windows, so
automated side-by-side of a terminal + JBrowse has no clean path. Options
explored, with their verdicts:

- **Manual tile** (user taps Super+←/→ during a countdown) — works, but Colin
  needs it *automated*, so this is out.
- **XWayland + xdotool.** `xdotool` sees and moves XWayland windows (`xclock`
  moved fine). But `gnome-terminal` is native-Wayland only (xdotool can't touch
  it), there was no X11 terminal, and post-launch moves on `xterm`/electron
  snapped back (Mutter offsets/ignores them). Colin called all the X11 stuff
  "turbo old school" — **abandon this**.
- **Composition** (capture JBrowse via MCP `screenshot`, render the TUI to an
  image, `ffmpeg hstack`) — Colin rejected it as "crazy". Don't.
- **`ydotool` + GNOME native tiling — the live lead.** `ydotool` injects real
  input at the kernel uinput level, so it can press the *same* `Super+←/→` a
  human would, triggering GNOME's own tiling — modern, works on native-Wayland
  windows, no X11. **Set up already**: `ydotool`/`ydotoold` installed; the
  daemon runs as `sudo ydotoold --socket-path=/tmp/.ydotool_socket
  --socket-own=1001:1001`; `YDOTOOL_SOCKET=/tmp/.ydotool_socket ydotool key
  125:1 106:1 106:0 125:0` sends Super+Right and returns clean.
  **Blocker found, not yet cleared**: `gsettings get org.gnome.mutter.keybindings
  toggle-tiled-left` / `toggle-tiled-right` are **empty (`@as []`)** on this box,
  so `Super+←/→` isn't bound to tiling. Next step: set them
  (`gsettings set org.gnome.mutter.keybindings toggle-tiled-left "['<Super>Left']"`
  and `-right "['<Super>Right']"`, `edge-tiling` is already `true`), then the
  sequence is: launch JBrowse (grabs focus) → `ydotool` Super+Right; launch the
  terminal (grabs focus) → `ydotool` Super+Left; then record. Focus-follows-new-
  window needs confirming (`org.gnome.desktop.wm.preferences focus-new-windows`).

`sudo` is **passwordless** here and Colin said to install whatever's needed, so
the ydotool path is fully open.

## Recommended next steps

1. Rebuild the desktop app (`pnpm --filter @jbrowse/desktop build`) — the render
   fix rides on it.
2. Finish the `ydotool` + GNOME-native-tiling path: bind the two
   `toggle-tiled-*` keys, confirm new windows take focus, then tile
   JBrowse-right / terminal-left automatically.
3. Wire that into `recordDemoTui.mjs` in place of its wait/countdown, keep
   `--model sonnet --verbose`, keep the built-in hg38, keep the burned-in ASS
   captions (already in the harness), and land the harness (it is WIP-committed
   with this handoff but not yet layout-complete).
4. Deliver `demo-captioned.mp4`; the take is `takes/brca1.mjs` (open hg38 at
   BRCA1 → zoom to the gene model → count exons), tuned already so the agent
   stays on task.

Operating notes for the whole harness live in
[`scripts/agent-demos/CLAUDE.md`](../../scripts/agent-demos/CLAUDE.md) (the
Linux section). Delete this handoff once the automated side-by-side take is
landing clips.
