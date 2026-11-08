---
name: video-tours
description: How do you frame, caption and script a video tour under website/scripts/videos so the clip shows what the spec meant, and which harness behaviours leave a plausible clip of the wrong thing? Read before writing or re-filming a tour.
audience: internal
kind: operations
---

# Filming a video tour

A tour is a spec under `website/scripts/videos/` that `generate-video.ts` films.
What a clip is for, and when a figure serves better:
[WEBSITE_WRITING.md](WEBSITE_WRITING.md) §"Videos". `check-video-specs`
(`video-spec-rules.ts`) holds the story shape: a goal line, at most five
captions, a payoff `delay` after the last action. This doc is what it cannot
see.

## Framing

- Set only a spec's height; the width is `VIDEO_FRAME_DEFAULTS`'s.
- Size the viewport from `video-report.ts`'s content report; none of its
  warnings fails the run. It measures the tallest state, not the last, so where
  states differ by hundreds of pixels, end on the tall one. It measures app
  height only, so size a dialog-centred tour to the dialog.
- Keep the payoff above the app's last 100px or so: the caption chip sits 32px
  off the frame's bottom.
- Size a hold for what the frame shows; the harness adds the caption's reading
  time.

## The end of a clip

- **The last repaints of a clip do not reach the file**, and a
  `recorder.stop() -> TIMEOUT` in the log loses whatever had not flushed. Make
  anything the last frame needs true well before it; never reopen a menu after
  the result.
- A screencast off a backgrounded tab is one frozen frame at the right duration;
  `probe-clip-motion.ts <clip.mp4>` counts distinct frames.
- End on the result, not by scrolling to text: the fence beside the clip carries
  text better than a film.

## Captions

- A `say` goes up when its step **starts**, so the meaning goes on the payoff: a
  `delay` after the result has drawn, whose line reads the frame.
- One line per phase, not per click. A line repeating the menu item or the typed
  value tells the viewer nothing the frame does not.
- Read a label for a `say` out of the frame; nothing holds it to a string the
  app draws. A CSS-uppercased label is not the string a `text` step matches.
- Write the caption from frames pulled either side of the beat (`ffmpeg -ss`),
  not from the spec's reasoning: a control can land and change nothing visible.

## Steps

- **A radio menu item leaves its menu open over its result**; close it with
  `leaveMenu(row)` in `shared.ts`. Escape leaves one level per press and fails
  past two; one click on `.MuiBackdrop-root` clears any depth. The wordmark is
  an SVG `<g>` with no `.click()`: it parks the pointer but cannot dismiss a
  menu.
- Put `cut` on the wait, not on the click that starts it. `cut: true` on a
  `type` step films a paste.
- Anchor a `drag` by locus (`fromAnchor`/`toAnchor`), not by measured pixels.
- **A display over its density gate still reports `ready`.** Wait on
  `{ type: 'waitForText', text: 'Too many features', hidden: true }`, then on
  the display. An LGV keeps its bp window across a resize, so opening the track
  selector zooms every row out about 25% and can push a lane over the gate;
  re-navigate after a drawer closes.
- Pin the height in the session across a display-type switch, which does not
  carry the old one.
- A tour that adds a track starts from a config without it, and films the
  display's defaults rather than the figures' settings.
- An action can write a second setting (`setUnit` sets `colorBy`), so a later
  click can change nothing and still report success. A radio already selected in
  the frame before the click is the tell; fix the order on the page too.
- Write the menu path the page prints, not the one verified in source, and let
  the run disagree.
- Keep tours on light tracks: data volume, not display type, starves
  swiftshader. `--headed` uses the real GPU.
