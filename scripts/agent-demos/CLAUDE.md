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

## The two takes

**`agentDemo.mjs <outdir>`** — JBrowse Desktop over MCP, driven by a real
`claude -p` session. Serves the built renderer, launches Electron, opens three
MCP connections (Claude's own, a camera that screenshots on a loop, a stage that
paints the caption strip), then feeds it the questions in `TURNS`. The captions
are what Claude actually said and actually sent; nothing here authors the
JavaScript on screen. Needs `pnpm --filter @jbrowse/desktop build` first, and
**no other JBrowse Desktop running** — the single-instance lock silently
forwards to the running one.

**`panelDemo.mjs <outdir> [rehearse]`** — Chrome with the real Claude side
panel, questions typed on the keyboard. **Its turn-completion detection is known
wrong; read the header before using it.** `rehearse` runs one short turn.

Then `encode.mjs <outdir>` or `encodeBrowser.mjs <outdir>` collapses the static
stretches — most of a take is the app sitting still while the model thinks — and
writes the mp4 and its poster. `readTranscript.mjs <outdir>/transcript.json`
prints what was asked and what each turn did, which is the first thing a
reviewer wants.

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

## The clips are not committed

`website/static/media/` is gitignored and the bytes live in the store via
`media.lock`; a finished clip gets there with `pnpm figures:push`, after it is
approved and embedded. `website/CLAUDE.md` § Videos has the order, and no check
enforces it.
