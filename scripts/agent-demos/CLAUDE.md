# scripts/agent-demos

Films a real Claude client driving JBrowse, for the clips
`website/scripts/video-specs.ts` calls `externalClips` — the ones `pnpm video`
cannot make, because there is no url to load, no steps to run and no live
session to hand a reader. The session is one an agent built during the take.
None of these run in CI; all are run by hand.

**A clip shows the client.** `recordDemoMac.mjs` (macOS) and `recordDemoTui.mjs`
(GNOME/Wayland) film the real Claude Code TUI in a terminal beside the app, so
the session that drove JBrowse is on screen next to JBrowse. `demoCore.mjs` is
what they share — serving the build, the bridge calls, the tmux driving, the cue
sheet — and each file holds only its own platform's half. `recordDemoLinux.mjs`,
`agentDemo.mjs` and `recordDemoApp.mjs` are earlier attempts kept for their
takes; `recordDemoApp.mjs`'s header says why filming the Claude desktop app
produced nothing publishable, and tmux giving real text state is why the TUI
harnesses are the ones that do.

**A take films the repo's own build**, with `build/mcpServer.js` as the client's
server — the plain-node entry from `electron/mcp/standalone.ts`. Pointing a
client at an installed app binary is what `website/docs/agents.md` documents for
readers, and a build without `resolveLaunchMode` answers `--mcp` by launching
the GUI while the client waits forever.

## macOS: `recordDemoMac.mjs`

`node scripts/agent-demos/recordDemoMac.mjs <outdir> [takes/<name>.mjs]` writes
`<outdir>/demo.mp4` and a 3x `demo-3x.mp4`, plus `panes.log` — the TUI pane
after each turn, which is the transcript a reviewer wants and is faster to read
than scrubbing the video. Take modules are the shared `TURNS`/`SHELL`/`SYSTEM`
shape; `STEPS` (a prompt with the sentence that narrates it) is this harness's
own variant.

Placement is deterministic here, so none of the Linux harness's workspace,
tiling-extension and seat0 apparatus is needed: System Events sets both window
frames outright. What does bite:

- **Terminal's font size must be set BEFORE its bounds.** Terminal answers a
  font change by resizing the WINDOW to preserve its column count, so bounds set
  first are silently undone. And the size belongs to the shared settings set
  (`Basic`), not the window, so the harness saves it and puts it back — leaving
  it changed edits the user's Terminal for good. 11pt renders about 7px per
  character once a Retina-sized crop is scaled to 1920; 16pt gives 79 columns
  that can be read.
- **The crop is the union of the two measured window frames**, in points times
  the backing scale, which the harness derives by comparing a `screencapture`
  probe against the desktop bounds rather than assuming 2. Nothing is read off
  the screen: the layout is confirmed by asking the app its own
  `window.innerWidth` over the bridge, once the first turn has opened a session.
- **`screencapture -l <windowid>`, not `-R <region>`.** Region capture only sees
  the current Mission Control space; window capture returns a clean,
  desktop-free image of the window on any space. `windowlist.swift` finds the
  id.
- **`libx264` cannot keep up** with a 3584x2000 crop — it runs at 0.88x and
  drops frames for the rest of the take. `h264_videotoolbox` does keep up.
- **No burnt-in captions.** This ffmpeg has neither libass nor libfreetype, so
  `ass=` and `drawtext` both fail; the cue sheet is written as a sidecar. With
  the TUI in frame the narration is largely redundant anyway — the viewer reads
  the real conversation.
- **Input needs both mechanisms and neither alone.** System Events cannot click
  (`-25211`); CGEvent unicode keystrokes do not reach the side panel. So
  `inputtool.swift` clicks and sends Cmd+A / Delete / Return, and System Events
  types. **One keystroke event per word** — a whole sentence in one event comes
  out reordered, and a take filmed "This page. isJBrowse" on camera.
- **A crashed take leaves the bridge socket file behind.** Existence is not the
  question, so the guard connect-tests it and removes a stale one; a socket that
  answers means a JBrowse is genuinely running and the take refuses.

The terminal running this needs **both** grants in System Settings, Privacy &
Security. Accessibility, for the synthetic keyboard and mouse. And Screen
Recording — without which `screencapture` does not fail, it returns a
**wallpaper-only image with no windows in it**, which reads convincingly as "the
window is on another Mission Control space". `ffmpeg -f avfoundation` blocks
outright instead, which is at least honest. The Swift helpers compile on demand.

### What the TUI does, and how a harness knows

Both of these cost a take, and both are version-sensitive enough to check again
when Claude Code updates:

- **Claude Code opens on a chooser whenever anything about the session is new**,
  and a take meets more than one: a fresh directory brings the trust prompt, and
  a machine with the Chrome extension installed brings its own. Everything typed
  goes into whichever is up, and the Enter ending the first prompt picks the
  highlighted option, after which the rest of the sentence falls through to the
  shell — which is how a take once filmed vim editing a file called `human`.
  `STARTUP_DIALOGS` in `demoCore.mjs` is the table; a new one shows up as "the
  TUI never reached its prompt", and the pane is saved to
  `<outdir>/tui-stuck.txt` so the next one takes a minute to add.
- **The readiness and working markers are the status line, so they rot.** The
  symptom is a take that dies with "never reached its prompt" over a
  `tui-stuck.txt` showing a TUI plainly sitting at its prompt. Add the new
  marker and keep the old ones; a stale alternative costs nothing. **`❯` is not
  one of them** — it is the cursor in those very choosers and a common shell
  prompt, so matching it declares the TUI ready before it exists. Turn detection
  waits for the spinner to APPEAR before accepting a settled pane, since a pane
  changes the instant a prompt is typed; and the spinner's elapsed counter goes
  `(49s ·` then `(1m 32s ·`, so a regex anchored on digits-then-`s` stops
  matching exactly when a turn is long enough to matter.
- **The invocation goes in a script, not down the wire.** A take's system prompt
  runs past a thousand characters, and zsh's line editor never submits a
  `send-keys` line that long — it redraws it, echoes it truncated and sits
  there, which reads exactly like a hung TUI. `<outdir>/cwd/start-session.sh`
  holds the command and the pane shows `./start-session.sh`, which is also the
  better thing to have on camera.
- **Drive the app by coordinates, never by gene name.** A name goes through the
  text index: more than one hit opens a results picker _over_ the app, and a hit
  launches whichever track answered it, adding a gene track the take never asked
  for. Both are `showHitTrack` working as designed, and both wreck a frame.

## Linux: `recordDemoTui.mjs`

`node scripts/agent-demos/recordDemoTui.mjs <outdir> [takes/<name>.mjs]` writes
`<outdir>/demo-captioned.mp4` — the same take modules, beside the built-in hg38,
with the narration burned in as ASS captions. The session runs in `<outdir>/cwd`
so a `SHELL` take's files stay out of the mp4, and `JBROWSE_DESKTOP_ROOT` points
the client at another checkout's `build/`, so a worktree can film against the
primary's.

- **Side-by-side is automated, and every part of it can fail silently.** The
  take walks to the last workspace, which dynamic workspaces keep empty, so the
  windows it opens are the only ones in frame and the only ones focus can land
  on; then `ydotool` presses Super+Right for JBrowse and Super+Left for the
  terminal, and GNOME's own tiling does the arranging.
- **An inactive session eats every injected key and says nothing.** A locked
  screen, or another VT in front — the GDM greeter counts — and `ydotool` still
  exits 0, the events still reach `/dev/input`, and the compositor never
  processes them. The harness refuses to start unless seat0's active session is
  yours; that check is the difference between a clear error and an hour of
  chasing the input stack. **Never inject Ctrl+Alt+F<n>**: it is the VT-switch
  chord, so it drops the session to the greeter, which is one way to arrive at
  the trap above.
- **Ubuntu binds the tiling keys through its Tiling Assistant extension**
  (`org.gnome.shell.extensions.tiling-assistant tile-left-half`), and leaves
  mutter's own `toggle-tiled-left`/`-right` explicitly empty. Empty mutter keys
  are not the missing binding they look like. The harness turns that extension's
  tiling popup off for the take and puts it back afterwards — it would otherwise
  cover the other half and swallow the next keystroke.
- **The layout is checked, not assumed.** `tmux display -p '#{client_width}'`
  follows the attached client, so a pane width that does not move says the
  tiling key went somewhere else, and the take stops before it films anything.
  JBrowse's own half can only be measured through `run_javascript`, which needs
  a session, so that check waits for the first turn to open one.
- **`app_version` is the only bridge call that answers before a session
  exists.** Everything else — including the renderer's internal `paint` — is
  either gated on the session or not in `MCP_TOOLS`, and the bridge refuses what
  is not declared there.
- It opens the built-in hg38, which renders on a fresh build; a stale one shows
  a protein3d/tss-react worker error, so **always rebuild first**.
- `ydotoold` has to be running and its socket readable by you:
  `sudo ydotoold --socket-path=/tmp/.ydotool_socket --socket-own=$(id -u):$(id -g)`.
- **The recorder is `recorder.py`, and it must stay alive.** GNOME's
  `org.gnome.Shell.Screencast` ties the recording to the D-Bus connection that
  started it, so `gdbus call` — which exits the instant the method returns —
  aborts it with `Sender has vanished`. The Python process holds one connection
  open for the whole take.
- **Under GPU-less Xvfb the electron GPU process fatals**
  (`GPU process isn't usable. Goodbye`) even with `--disable-gpu` and
  swiftshader flags, which is why this films on the real `:0` display. The
  terminal half works fine under Xvfb; JBrowse does not.
- Isolated `--user-data-dir` under `<outdir>`, so a take never touches a real
  session, the recent list or an autosave.

## The takes

A take module exports `TURNS` (or `STEPS`), `SHELL` and `SYSTEM`. `SHELL: true`
drops `--restricted` and allows Bash and the file tools beside the MCP ones, for
the takes whose point is work the app cannot do (an aligner, a fold, a
consensus); `SYSTEM`, a function of the working directory, is appended to the
system prompt, so the working directory and the pre-staged files are handed over
off camera and the question on screen stays as short as a person would type it.
The shell takes are in `takes/`, each with a `.md` beside it saying what was
verified, what a good take does turn by turn, and what is still open. Pre-stage
into `<outdir>/cwd` before running; the harness creates that directory and
leaves what is in it. **No other JBrowse Desktop may be running** — the
single-instance lock silently forwards to it.

`webDemo.mjs <outdir> <deviceId>` is the odd one out: a LOCAL jbrowse-web build
driven through the Claude in Chrome extension by a headless `claude -p --chrome`
session, no filming. It is the proof that `window.jb` works from the client it
was built for, and the agent gets only the website pages (`agents.md`,
`agents_live_model.md`) as its system prompt. That extension's own behaviour —
its deferred tools, `javascript_tool` evaluating in the page's MAIN world, the
result sanitizing that has hit a display type name — is documented for agents in
`website/docs/agents_live_model.md` § "In a browser".

`take5-transcript.txt` and `takes/*-take1-transcript.txt` are rendered
transcripts of the takes whose clips are awaiting a verdict — reading what the
agent did is faster than scrubbing the video. Delete one when its clip lands.

Then `encode.mjs <outdir>` or `encodeBrowser.mjs <outdir>` collapses the static
stretches — most of a take is the app sitting still while the model thinks — and
writes the mp4 and its poster. `readTranscript.mjs <outdir>/transcript.json`
prints what was asked and what each turn did, which is the first thing a
reviewer wants.

## The clips are not committed

`website/static/media/` is gitignored and the bytes live in the store via
`media.lock`; a finished clip gets there with `pnpm figures:push`, after it is
approved and embedded. `website/CLAUDE.md` § Videos has the order, and no check
enforces it.
