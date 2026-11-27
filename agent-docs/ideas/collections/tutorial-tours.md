---
name: tutorial-tours
description: Video tours not yet filmed, tutorial pages first and then the zero-figure user guides, each with the prose it would let its page cut, plus a recorder for a JBrowse Desktop tour. Read before writing a video spec.
audience: internal
---

# Tours worth filming

Colin's standing preference: film the tutorials before the user guides. A clip
retires no figure ([WEBSITE_WRITING.md](../../reference/WEBSITE_WRITING.md)
§"Videos"), so each candidate names the prose it would let its page cut. The
numbers are IDs, not a ranking; a new entry takes the next free number.
Filming: [VIDEO_TOURS.md](../../reference/VIDEO_TOURS.md). The harness gaps a
tour can hit have their own files in `ready/`.

The strand tour on `rnaseq.md` waits on that page's restructuring:
[spine-the-rnaseq-tutorial-on-the-nelfe-skiv2l-pair](../waiting-on-a-call/spine-the-rnaseq-tutorial-on-the-nelfe-skiv2l-pair.md).

## Tutorials

- **18 `orthofinder_synteny/same_scale`** (`orthofinder_synteny.md`): the view
  menu's **Show whole genome** then **Square view - same bp per pixel**, the fly
  stack's rows re-scaling from equal length to genome length, which the
  opening's bullet describes and no figure holds. Both rows are actions, so the
  tour needs no Escape-and-blur. The fly stack is the page's one whole-genome
  stack, so it is the target.
- **19 `local_ancestry/cluster_painting`** (`local_ancestry.md`):
  **Clustering → Cluster rows by similarity...** on the ancestry painting. The
  prose describing the clustered painting has had no figure since
  `dog10k-wolfdog-ancestry-clustered` was deleted. It does not fit the frame:
  the claim is about the 243-animal painting, whose 486 rows were a 2,610 px
  capture against a 1920-wide encode ceiling and a 960 default height. The
  64-row named track is already in descending wolf-fraction order, so the
  reorder barely moves there. Revisit if a per-clade cut of that BED is hosted.

## User guides

Ordered by value to a reader over the risk the harness chokes.

- **5 `ui/open_connection_hub`** (`user_guides/connections.md`, no figures).
  Opens on `test_data/hg38_only.json` (`"tracks": []`), so everything on screen
  at the end came from the hub. Films the behaviour the page asserts and cannot
  picture: expanding a category is what fetches.
- **6 `ui/spreadsheet_row_launch`** (`user_guides/spreadsheet_view.md`, one
  figure, mostly bulleted clicks). Half the steps are already proven in
  `videos/sv.ts`.
- **7 `synteny/launch_from_lgv`** (`user_guides/linear_synteny_view.md`): a
  dataset field that refetches, a panel list with arrows, and a neighbours rule
  that means nothing until the list is on screen. `three_strain_import` films
  the other way into this view.
- **8 `ui/circular_chords`** (`user_guides/circular_view.md`): an empty ring,
  chords appearing when a track is ticked, and a chord click opening a second
  view, three claims with one still.

## A Desktop tour needs a recorder

Desktop figures come from a Selenium and Electron run over the packaged binary
([screenshots.ts](../../../products/jbrowse-desktop/test/screenshots.ts)),
whose only capture is `driver.takeScreenshot()`; `generate-video.ts` films a
puppeteer page with `page.screencast`, which Electron's chromedriver does not
offer. So `quickstart_desktop.md`, the docs' heaviest click narration, has no
tour.

The Selenium run already sits on an X server (`screenshots:headless` in
`products/jbrowse-desktop/package.json` runs it under `xvfb-run`).
`ffmpeg -f x11grab` against that display, started before the script and stopped
after, films the session, the native file picker included. It needs the display
pinned (`xvfb-run -n`, or `$DISPLAY` read in-script) and an even-sided screen
at or under `VIDEO_OUTPUT_WIDTH`. The drawn cursor, `say` chips and captions
come from `video-overlay.ts`, a puppeteer facility, so a first Desktop clip
ships without them.

- **`desktop/open_a_local_file`**: start screen, a genome opened, a build
  script's output file opened from disk, the track drawing. One clip, linkable
  from every page whose build script ends on `npx --yes serve <build>/jbrowse2`.
