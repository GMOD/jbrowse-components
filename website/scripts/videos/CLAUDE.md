# website/scripts/videos

What a tour is for, and the embed order: `website/CLAUDE.md` § Videos.
`check-video-specs` (rules in `video-spec-rules.ts`) pairs specs with embeds in
both directions, and `pnpm video` runs it before filming.

## Framing

- A spec states only its height; the width comes from `VIDEO_FRAME_DEFAULTS`.
- **A re-frame needs `pnpm autogen`**, since the embed reserves its box from
  `videoFrames` in `liveLinks.generated.ts`.
- A clip's anchor id comes from its spec name, so renaming a spec breaks inbound
  links and nothing checks them.
- Size the viewport from `video-report.ts`'s content report. None of its
  warnings fails the run. The report measures the tallest state, not the last,
  so where states differ by hundreds of pixels, end on the tall one. It measures
  app height only, so size a dialog-centred tour to the dialog.
- The caption chip sits 32px off the frame's bottom, over the app's last 100px
  or so.
- The harness sets the pace: a spec's holds cover what the frame shows, never
  how long the caption takes to read.

## The end of a clip

- **The last repaints of a clip do not reach the file**, and a
  `recorder.stop() -> TIMEOUT` in the log loses whatever had not flushed.
  Anything that must be true in the last frame must be true well before it;
  never reopen a menu after the result.
- The poster is the middle of the payoff line, not the last frame.
- A screencast off a backgrounded tab is one frozen frame at the right duration.
  `probe-clip-motion.ts <clip.mp4>` counts distinct frames.
- Don't end by scrolling to text: the fence beside the clip carries text better
  than a film.

## Captions

- A `say` goes up when its step **starts**, so the meaning goes on the payoff: a
  `delay` after the result has drawn, whose line reads the frame.
- One line per phase, not per click. A line that repeats the menu item or the
  typed value tells the viewer nothing the frame does not.
- A tour that grows its first `say` must be re-filmed, or the page carries a
  caption track that 404s.
- Nothing holds a `say` to a string the app draws: read the label out of the
  frame. A CSS-uppercased label is not the string a `text` step matches.
- Write the caption from frames pulled either side of the beat (`ffmpeg -ss`),
  not from the spec's reasoning: a control can land and change nothing visible.

## Steps

- **A radio menu item leaves its menu open over its result.** `leaveMenu(row)`
  in `shared.ts` takes the whole cascade down. Escape leaves one level per press
  and fails past two; one click on `.MuiBackdrop-root` clears any depth. The
  wordmark is an SVG `<g>` with no `.click()`, so it parks the pointer but
  cannot dismiss a menu.
- `cut` goes on the wait, not on the click that starts it. `cut: true` on a
  `type` step films a paste.
- Anchor a `drag` by locus (`fromAnchor`/`toAnchor`), never by measured pixels.
- **A display over its density gate still reports `ready`.** Wait on
  `{ type: 'waitForText', text: 'Too many features', hidden: true }`, then on
  the display. An LGV keeps its bp window across a resize, so opening the track
  selector zooms every row out about 25% and can push a lane over the gate;
  re-navigate after a drawer closes.
- A display-type switch does not carry the old height; pin the height in the
  session.
- A tour that adds a track starts from a config without it, and films the
  display's defaults rather than the figures' settings.
- An action can write a second setting (`setUnit` sets `colorBy`), so a later
  click can change nothing and still report success. A radio already selected in
  the frame before the click is the tell; fix the order on the page too.
- The session comes from a `*VideoFixtures` bag in `../specs/`, and form values
  from the page's own fence (`check-paste-configs`).
- Write the menu path the page prints, not the one verified in source, and let
  the run disagree.
- Keep tours on light tracks. Data volume, not display type, starves
  swiftshader; `--headed` uses the real GPU.
