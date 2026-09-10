# scripts/agent-demos

Films a real Claude client driving JBrowse, for the clips
`website/scripts/video-specs.ts` calls `externalClips` — the ones `pnpm video`
cannot make, because there is no url to load, no steps to run and no live
session to hand a reader. The session is one an agent built during the take.

**A clip shows the client.** `recordDemoMac.mjs` (macOS) and `recordDemoTui.mjs`
(GNOME/Wayland) both film the real Claude Code TUI in a terminal beside the app,
so the session that drove JBrowse is on screen next to JBrowse. `demoCore.mjs`
is what they share — serving the build, the bridge calls, the tmux driving, the
cue sheet — and each file holds only its own platform's half.
`recordDemoLinux.mjs` is the same idea one iteration back, filming a formatted
`claude -p` stream rather than the TUI. `agentDemo.mjs` is the oldest: it filmed
only the JBrowse WINDOW through a screenshot loop and painted a caption strip
with what Claude said, and the published `externalClips` came from it — kept for
its accumulated notes and its takes. None run in CI; all are run by hand.

**The released app has no MCP.** JBrowse Desktop 4.3.0 — what
`/Applications/JBrowse 2.app` auto-updates itself to — contains no `--mcp`, no
`--version` and no CLI handling at all: `resolveLaunchMode` ships in
5.0.0-beta.2. So the install snippet in `website/docs/agents.md`, which points a
client at the app binary with `--mcp`, silently LAUNCHES THE GUI on any build a
reader can download today, and the client waits forever on a server that never
speaks. That is correct for docs shipping alongside v5 and wrong before it. A
take therefore films the repo's own build, with `build/mcpServer.js` as the
client's server — the plain-node entry from `electron/mcp/standalone.ts`.

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
- **`libx264` cannot keep up** with a 3584x2000 crop — it runs at 0.88x and
  drops frames for the rest of the take. `h264_videotoolbox` does keep up.
- **No burnt-in captions.** This ffmpeg (brew 9.0.1) has neither libass nor
  libfreetype, so `ass=` and `drawtext` both fail; the cue sheet is written as a
  sidecar. With the TUI in frame the narration is largely redundant anyway — the
  viewer reads the real conversation.
- **A crashed take leaves the bridge socket file behind.** Existence is not the
  question, so the guard connect-tests it and removes a stale one; a socket that
  answers means a JBrowse is genuinely running and the take refuses.

### What the TUI actually does, and how a harness knows

Both these cost a take, and both are version-sensitive enough to check again
when Claude Code updates:

- **Claude Code opens on a chooser whenever anything about the session is new**,
  and a take meets more than one: the fresh directory brings "Is this a project
  you created or one you trust?", and a machine with the Chrome extension
  installed brings "Claude in Chrome extension detected". Everything typed goes
  into whichever is up, and the Enter ending the first prompt picks the
  highlighted option — "No, exit" for the trust one — after which the rest of
  the sentence falls through to the shell, which is how a take once filmed vim
  editing a file called `human`. `STARTUP_DIALOGS` in `demoCore.mjs` is the
  table; a new one shows up as "the TUI never reached its prompt", and the pane
  is saved to `<outdir>/tui-stuck.txt` so the next one takes a minute to add.
- **The readiness markers are the status line, so they rot.** 2.1.263 draws
  `claude | cwd-4e | Sonnet 5 | medium | 0/1M 0% | $0.00` over
  `⏵⏵ auto mode on (shift+tab to cycle) · ← for agents`, and carries none of
  `bypass permissions`, `N tokens` or `? for shortcuts` — the three `TUI_READY`
  matched until 2026-09-07. The symptom is a take that dies with "never reached
  its prompt" over a `tui-stuck.txt` showing a TUI plainly sitting at its
  prompt. Add the new marker, keep the old ones; a stale alternative costs
  nothing.
- **`❯` is not a readiness marker.** It is the cursor in those very choosers,
  and it is a common shell prompt (`❯❯❯` here), so matching it declares the TUI
  ready before it exists. Match `bypass permissions`, `N tokens` or
  `? for shortcuts` instead.
- **The invocation goes in a script, not down the wire.** A take's system prompt
  runs past a thousand characters, and zsh's line editor never submits a
  `send-keys` line that long — it redraws it, echoes it truncated and sits
  there, which reads exactly like a hung TUI. `<outdir>/cwd/start-session.sh`
  holds the command and the pane shows `./start-session.sh`, which is also the
  better thing to have on camera.
- **A turn past a minute reads as idle** unless the spinner pattern matches the
  unit. The counter goes `(49s ·` then `(1m 32s ·`, so a regex anchored on
  digits-then-`s` stops matching exactly when a turn is long enough to matter,
  and the take declares it done mid-thought and stops the camera over a working
  agent.
- **Drive the app by coordinates, never by gene name.** A name goes through the
  text index: more than one hit opens a results picker _over_ the app, and a hit
  launches whichever track answered it, adding a gene track the take never asked
  for. Both are `showHitTrack` working as designed, and both wreck a frame.
- **The working marker has moved.** 2.1.263 draws
  `✽ Newspapering… (5s · ↓ 186 tokens)` and never says `esc to interrupt`, which
  older builds did and which `recordDemoTui.mjs` still keys on. The
  elapsed-seconds counter is the stable part; the finished line
  (`Cooked for 19s · done`) has no parenthesis, so it does not read as still
  working. Turn detection waits for the spinner to APPEAR before accepting a
  settled pane — a pane changes the instant a prompt is typed, so settling alone
  declares a turn finished before the model has started it.

## macOS: `recordDemoApp.mjs` — the Claude app, and why it is not the one to use

`node scripts/agent-demos/recordDemoApp.mjs <outdir> [takes/<name>.mjs] [--dry-run]`
films Claude Code inside the Claude desktop app instead of the TUI, with
`appClient.mjs` holding everything app-specific. It runs end to end — the smoke
take encodes in 75s — and the output was still judged **not showcase material**
on 2026-09-08. Read this before reaching for it again.

**The TUI harness is the one that makes publishable clips**, because tmux gives
real text state. Here every single interaction is a pixel probe, and on the
first real take three of them failed SILENTLY at once: the model never switched,
the account email and usage card filmed, and the session's folder was detached
by a blind banner click, so the agent aligned two unrelated FASTAs it found
elsewhere on disk while reporting success.

What is established, each of it paid for:

- **MCP reaches the app only through `claude_desktop_config.json`.** A
  user-scope entry in `~/.claude.json` is ignored, a project `.mcp.json` is
  ignored, and `/mcp` opens the connector Directory — a remote marketplace a
  local stdio server is never in. The app reads that file at LAUNCH and spawns
  one server child per surface, so `pgrep` on the server path proves it loaded
  without spending a turn.
- **`claude://code/new?folder=<urlencoded>&source=services`** opens a session in
  a named folder. The app must be fully quit first, polled rather than slept on:
  a running app makes the deep link merely FOCUS it, and the session lands in
  whatever workspace it already had.
- **The trust modal is up on every launch**, including for a folder trusted
  minutes earlier, with **Cancel** focused — so a synthetic Return abandons the
  session. Its absence is the signal that the deep link did not open the folder.
- **Its confirm button is found by pixels, never by offset.** The modal grows
  with the length of the path it names, so a take in a deep directory has its
  buttons ~20 points below one in a short directory. It is the only filled white
  control on screen, which `whiteControl` in `appClient.mjs` locates.
- **Clicks land only when the app is frontmost, and the first one after
  activating is eaten** by the activation itself. Every click activates, waits,
  then clicks.
- **The sidebar is a persisted toggle and its panel is DARKER than the content**
  — 17 against 21 — so a probe with the sense backwards reports "already
  collapsed" over an open sidebar and films the account email and every past
  session title. `sidebarMode` in the app config is which sidebar, not whether.
- **Three banners arrive unbidden** (notifications-off, a model promo, an
  approaching-weekly-usage warning that also puts the reset date on camera), and
  each is a different height, so there is no single offset for its close glyph.
  A ladder of blind clicks is how the folder chip got detached; detect the strip
  changed, and never click over the composer chrome speculatively.
- **The model menu's digit accelerators do not take**, silently. Click the row —
  measured UP from the window bottom in POINTS, 157.5 for the topmost and 24 a
  row — and then read the blue tick beside the current model back, which is the
  only proof. Reading those offsets off a screenshot in pixels selects two rows
  out, which lands on a model that may be rate-limited, changing nothing.
- **There is no transcript on disk.** Nothing appears under
  `~/.claude/projects/` for an app session, so turn detection is a hash of the
  conversation pane: the same state machine `demoCore.waitTurnDone` runs against
  a tmux pane, with every sample logged to `<outdir>/turn-samples.log` because
  that log is the only evidence for why a turn was called done. The send button
  is NOT the signal — it stays a send arrow for the whole turn.
- **Stillness cannot tell "blocked" from "finished".** In Auto mode the app
  blocks any command it cannot statically analyze (`ls -la "$(pwd)"` was one)
  and waits on a dialog, so the window goes as quiet as a finished turn. A
  shell-heavy take needs Bypass permissions, or a detector that finds the
  dialog's own white "Allow once" button.
- **`--dry-run` stops before the camera**, so startup and chrome cleanup can be
  iterated for zero model turns. Use it: every bug above was found by spending
  turns until it was added.
- **The app has none of the CLI's three flags.** The take's `SYSTEM` becomes
  `<cwd>/CLAUDE.md`, `--allowedTools` becomes the permission mode, and
  `--strict-mcp-config` has no equivalent, so the session also sees whatever
  connectors the account has. The app is launched through LaunchServices and
  does not inherit the shell environment either, so the harness resolves
  `minimap2` and the repo CLI to absolute paths in that CLAUDE.md —
  `which jbrowse` is an fnm shim whose path dies with the shell.

## Linux: `recordDemoTui.mjs`

`node scripts/agent-demos/recordDemoTui.mjs <outdir> [takes/<name>.mjs]` writes
`<outdir>/demo-captioned.mp4`. It shows the REAL Claude Code TUI (Sonnet,
`--verbose`) driven by `tmux send-keys` — not the formatted `claude -p` stream
`recordDemoLinux.mjs` films, which reads as a fake — beside the built-in hg38,
with the narration burned in as ASS captions.

**It takes the same take modules `recordDemoMac.mjs` does**: `STEPS`, and
optionally `SYSTEM(cwd)` and `SHELL`. Without one, the BRCA1 steps at the top of
the file are the take. The session runs in `<outdir>/cwd`, so a `SHELL` take's
files stay out of the recorder's own mp4 and captions, and the invocation goes
through a `start-session.sh` there rather than down `send-keys` — a take's
system prompt runs past a thousand characters and the shell's line editor
silently truncates a line that long instead of submitting it.
`JBROWSE_DESKTOP_ROOT` points the client at another checkout's `build/`, so a
worktree can film against the primary's.

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
  chasing the input stack.
- **Never inject Ctrl+Alt+F<n>.** It is the VT-switch chord, so it drops the
  session to the greeter — which is one way to arrive at the trap above.
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
- The recorder, the isolated `--user-data-dir` and the real-display requirement
  are `recordDemoLinux.mjs`'s, described below; both harnesses use them.

## Linux: `recordDemoLinux.mjs`

`node scripts/agent-demos/recordDemoLinux.mjs <outdir> [takes/<name>.mjs]`, on a
GNOME/Wayland session. It launches JBrowse Desktop on the real display (real
GPU), runs a real `claude -p` MCP session whose live stream renders in a visible
"Claude session" terminal, records the whole screen, and writes
`<outdir>/demo.mp4`. Take modules are the same `TURNS`/`SHELL`/`SYSTEM` shape as
the macOS takes.

- **The recorder is `recorder.py`, and it must stay alive.** GNOME's
  `org.gnome.Shell.Screencast` ties the recording to the D-Bus connection that
  started it, so `gdbus call` — which exits the instant the method returns —
  aborts it with `Sender has vanished`. The Python process holds one connection
  open for the whole take. It records to mp4 (GNOME's configured container),
  needs no portal dialog, and captures the real screen at full framerate.
- **Wayland will not let a client position itself**, and there is no scriptable
  tiling API. This one waits for a hand to tap Super+Left / Super+Right;
  `recordDemoTui.mjs` automates the same two keystrokes through `ydotool`.
- **Under GPU-less Xvfb the electron GPU process fatals**
  (`GPU process isn't usable. Goodbye`) even with `--disable-gpu` and
  swiftshader flags, which is why this films on the real `:0` display rather
  than a headless one. The terminal half works fine under Xvfb; JBrowse does
  not.
- Isolated `--user-data-dir` under `<outdir>`, so a take never touches a real
  session, the recent list or an autosave. Refuses to start if a JBrowse Desktop
  bridge socket already exists (its bridge is per-user).

## macOS: before anything works

The rest of this file is the macOS harness. The terminal running it needs
**both** grants in System Settings, Privacy & Security:

- **Accessibility** — for the synthetic keyboard and mouse.
- **Screen Recording** — and without it `screencapture` does not fail. It
  returns a **wallpaper-only image with no windows in it**, which reads
  convincingly as "the window is on another Mission Control space". That one
  cost an afternoon. `ffmpeg -f avfoundation` blocks outright instead, which is
  at least honest.

The Swift helpers compile on demand the first time a script needs them.

## The takes

**`agentDemo.mjs <outdir> [takes/<name>.mjs]`** — JBrowse Desktop over MCP,
driven by a real `claude -p` session. Serves the built renderer, launches
Electron, opens three MCP connections (Claude's own, a camera that screenshots
on a loop, a stage that paints the caption strip), then feeds it the questions
in `TURNS`. The captions are what Claude actually said and actually sent;
nothing here authors the JavaScript on screen. Needs
`pnpm --filter @jbrowse/desktop build` first, and **no other JBrowse Desktop
running** — the single-instance lock silently forwards to the running one.

Without a take module it runs the GEO take that became take 5. A take module
exports `TURNS`, `SHELL` and `SYSTEM`. `SHELL: true` drops `--restricted` and
allows Bash and the file tools beside the MCP ones, for the takes whose point is
work the app cannot do (an aligner, a fold, a consensus); `SYSTEM`, a function
of the working directory, is appended to the system prompt, so the working
directory and the pre-staged files are handed over off camera and the question
on screen stays as short as a person would type it. The three shell takes are in
`takes/`, each with a `.md` beside it saying what was verified, what a good take
does turn by turn, and what is still open. Pre-stage into `<outdir>/cwd` before
running; the harness creates that directory and leaves what is in it.

**`panelDemo.mjs <outdir> [rehearse]`** — Chrome with the real Claude side
panel, questions typed on the keyboard. **Its turn-completion detection is known
wrong; read the header before using it.** `rehearse` runs one short turn.

**`webDemo.mjs <outdir> <deviceId>`** — a LOCAL jbrowse-web build driven through
the Claude in Chrome extension by a headless `claude -p --chrome` session, no
filming. The proof that `window.jb` works from the client it was built for. The
agent gets only the website pages (`agents.md`, `agents_live_model.md`) as
system prompt; `deviceId` comes from the extension's `list_connected_browsers`
(two Chrome installs register here, so it must be named). Needs
`pnpm --filter @jbrowse/web build` first. Writes `transcript.json` and every
screenshot the agent took as `shot-NN.png`.

Then `encode.mjs <outdir>` or `encodeBrowser.mjs <outdir>` collapses the static
stretches — most of a take is the app sitting still while the model thinks — and
writes the mp4 and its poster. `readTranscript.mjs <outdir>/transcript.json`
prints what was asked and what each turn did, which is the first thing a
reviewer wants.

## What the Chrome extension actually is

Established while proving `window.jb` from it (`webDemo.mjs`), each a dead end
first:

- **Its tools are deferred.** A headless `claude -p --chrome` session lists only
  the built-ins until `ToolSearch` pulls `mcp__claude-in-chrome__*`. They are
  there; they are not advertised.
- **"Claude in Chrome requires permission" is Claude Code's own allowlist**, not
  Chrome. `--allowedTools mcp__claude-in-chrome` clears it.
- **`javascript_tool` evaluates in the page's MAIN world**, so
  `window.JBrowseSession` and `window.jb` are simply there. It returns the last
  expression, not a `return`; caps one evaluation at 45 s while the code runs
  on; and sanitizes results (depth-truncated objects, clipped strings, any
  string that looks like base64 replaced with a `[BLOCKED]` marker, which has
  hit a display type name). `website/docs/agents_live_model.md` § "In a browser"
  carries the agent-facing version of these; `agents_web.md` was folded into it
  and `agents.md` in 2026-08.
- **Naming the browser is two calls**, `list_connected_browsers` then
  `select_browser` with its `deviceId`, and two Chrome installs register the
  extension here, so a headless run has to be told the id in its prompt.
- It can read `file://` URLs if granted, and that is the whole extent of its
  local reach: no writes, no child process, no indexing. GEO bigWigs fetch from
  the jbrowse.org origin with real bytes, so CORS is not the blocker there that
  it is for some hosts.
- Chrome raises a `"Claude" started debugging this browser` infobar while the
  extension works, which changes the frame height mid-clip.

## What cost the most to find

- **`screencapture -l <windowid>`, not `-R <region>`.** Region capture only sees
  the current Mission Control space; window capture returns a clean,
  desktop-free image of the window on any space, and is the better frame anyway.
  `windowlist.swift` finds the id.
- **Input needs both mechanisms and neither alone.** System Events cannot click
  (`-25211`); CGEvent unicode keystrokes do not reach the side panel. So
  `inputtool.swift` clicks and sends Cmd+A / Delete / Return, and System Events
  types.
- **One keystroke event per word.** A whole sentence in one event comes out
  reordered — a take filmed "This page. isJBrowse" on camera.
- **`Cmd+E` toggles the Claude side panel**, from the extension's
  `toggle-side-panel` command.
- **Dismiss the panel's account notices before filming.** One of them names the
  weekly usage remaining on the account being filmed.
- The pixel coordinates in `panelDemo.mjs` were measured at its `WIN` size. They
  are not derived from anything, so a different window size needs them measured
  again.

`take5-transcript.txt` is the last desktop take rendered by `readTranscript.mjs`
— kept because that clip is still awaiting a verdict, and reading what the agent
did is faster than scrubbing the video. Delete it when the clip lands.
`takes/*-take1-transcript.txt` are the same for the shell takes; their clips are
`website/static/media/mcp/agent_<take>_take1.mp4`.

## The clips are not committed

`website/static/media/` is gitignored and the bytes live in the store via
`media.lock`; a finished clip gets there with `pnpm figures:push`, after it is
approved and embedded. `website/CLAUDE.md` § Videos has the order, and no check
enforces it.
