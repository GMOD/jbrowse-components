# scripts/agent-demos

Films a real Claude Code TUI driving JBrowse Desktop beside the app, for the
`externalClips` in `website/scripts/video-specs.ts` that `pnpm video` cannot
make. Run by hand, never in CI.

- `recordDemoMac.mjs` (macOS) and `recordDemoTui.mjs` (GNOME/Wayland) are the
  harnesses; `demoCore.mjs` is their shared half. The other `recordDemo*` files
  are earlier attempts kept for their takes.
- A take films the repo's own build, with `build/mcpServer.js` as the client's
  server. **Rebuild first**: a stale build shows a protein3d/tss-react worker
  error, and one without `resolveLaunchMode` answers `--mcp` by opening the GUI
  while the client waits forever.
- **No other JBrowse Desktop may be running**; the single-instance lock forwards
  to it silently.
- Shoot `takes/smoke.mjs` first when the loop has not run for a while, and clear
  a take's directory of everything but `cwd/` before rerunning.

## The takes

A take module exports `TURNS` (or `STEPS` on macOS), `SHELL` and `SYSTEM`.
`SHELL: true` drops `--restricted` and allows Bash and file tools; `SYSTEM`
hands the working directory and pre-staged files over off camera. Pre-stage into
`<outdir>/cwd`. Each shell take has a `.md` beside it with what a good take does
and what is still open. A `*-transcript.txt` is a rendered transcript of a clip
awaiting a verdict; delete it when the clip lands.

`encode.mjs` / `encodeBrowser.mjs` collapse the static stretches.
`readTranscript.mjs <outdir>/transcript.json` prints what each turn did. A
finished clip reaches the media store as in `website/CLAUDE.md` § Videos.

## The TUI

Two TUI behaviors each cost a take, and both change when Claude Code updates:

- **Claude Code opens on a chooser whenever anything about the session is new**
  (trust prompt, Chrome extension), and the Enter ending the first prompt picks
  an option there. `STARTUP_DIALOGS` in `demoCore.mjs` is the table; a new one
  shows up as "the TUI never reached its prompt", with the pane saved to
  `<outdir>/tui-stuck.txt`.
- **The readiness and working markers are the status line, so they change with
  it.** Add the new marker and keep the old ones. `❯` is not one: it is also the
  chooser's cursor and a shell prompt.
- The invocation goes in `<outdir>/cwd/start-session.sh`: zsh never submits a
  `send-keys` line as long as a take's system prompt.
- Drive the app by coordinates, never by gene name: a name can open a results
  picker over the app or launch an unwanted gene track.

## macOS

- Grant the terminal both **Accessibility** and **Screen Recording**. Without
  Screen Recording, `screencapture` returns a wallpaper-only image instead of
  failing.
- Set Terminal's font size **before** its bounds; a font change resizes the
  window. The size lives in the shared `Basic` settings set, so the harness
  restores it.
- `screencapture -l <windowid>`, not `-R`: region capture sees only the current
  Mission Control space.
- Encode with `h264_videotoolbox`; `libx264` drops frames at this crop size.
  This ffmpeg has neither libass nor libfreetype, so cues go in a sidecar.
- `inputtool.swift` clicks and sends control keys; System Events types, **one
  keystroke event per word**, since a whole sentence arrives reordered.
- A crashed take leaves the bridge socket file; the guard connect-tests it.

## Linux

- The take runs in its own headless GNOME Shell on a private session bus;
  `<outdir>/shell.log` is its stderr. `JBROWSE_DESKTOP_ROOT` points at another
  checkout's `build/`.
- Tiling goes through mutter's RemoteDesktop (`remoteInput.py`), not ydotool,
  which a headless shell does not read. Ubuntu binds the tiling keys through
  Tiling Assistant, and mutter's own keys are empty on purpose. The harness
  turns that extension's popup off for the take through dconf, which the real
  desktop shares.
- `recorder.py` must stay alive: the GNOME screencast dies with the D-Bus
  connection that started it.
- `app_version` is the only bridge call answering before a session exists.
- Stop a take with
  `kill -INT $(pgrep -xf "node scripts/agent-demos/recordDemoTui.mjs")`; a bare
  `pkill -f` kills the shell running it first.

## Web

`webDemo.mjs <outdir> <deviceId>` drives a local jbrowse-web build through the
Claude in Chrome extension from a headless `claude -p --chrome`, with only the
website's agent pages as the system prompt. No filming.
