# scripts/agent-demos

Films a real Claude client driving JBrowse, for the clips
`website/scripts/video-specs.ts` calls `externalClips` — the ones `pnpm video`
cannot make, because there is no url to load, no steps to run and no live
session to hand a reader. The session is one an agent built during the take.

macOS only, and none of it runs in CI. Not a pipeline: these are run by hand
when a clip is wanted.

## Before anything works

The terminal running these needs **both** grants in System Settings, Privacy &
Security:

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
  hit a display type name). `website/docs/agents_web.md` carries the
  agent-facing version of these.
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
