---
name: r-export
description: The R script export — a view's tracks as ggjbrowse reader calls plus one jbrowse_stack() call; where its code lives, what each display exports, the settled decisions, and how to verify a change. Read before changing it.
audience: internal
kind: spec
---

# R script export

The linear genome view's menu item **Export R script** downloads a `.R` that
redraws the view in R through [ggjbrowse](https://github.com/GMOD/ggjbrowse),
JBrowse's own engine in R ([TABLES.md](TABLES.md)):

- **In:** the view's open tracks and the regions on screen.
- **Out:** a short script: one ggjbrowse reader per track, `fig <-
  jbrowse_stack(...)`, `print(fig)`, `ggsave()`. It shows the figure when
  sourced (`source()` prints nothing without `print`) and writes `figure.png`
  under `Rscript`.

## Where the code is

`plugins/linear-genome-view/src/LinearGenomeView/rExport/`, imported lazily
from the view menu (`menuItems.ts`):

- `rScript.ts`: the pure part. `exportTracksToR` maps each track to its
  reader (`READERS`), writes the file argument, the regions and the
  display's settings, and assembles the script.
- `exportLinearView.ts`: reads the live view (regions on screen, each track's
  first display, adapter, and the view's assembly config as written) and
  downloads the script.

| Display                           | Reader               | Adapters                                         |
| --------------------------------- | -------------------- | ------------------------------------------------ |
| `LinearBasicDisplay`              | `jbrowse_features`   | GFF3, GTF, BED (plain or tabix), BigBed          |
| `LinearVariantDisplay`            | `jbrowse_features`   | VCF (plain or tabix)                             |
| `LinearMultiSampleVariantDisplay` | `jbrowse_variants`   | VCF (plain or tabix)                             |
| `LinearWiggleDisplay`             | `jbrowse_wiggle`     | BigWig, multi-BigWig                             |
| `LinearAlignmentsDisplay`         | `jbrowse_alignments` | BAM, CRAM                                        |

Any other display, a file opened from disk in jbrowse-web (a `blob:` URL R
cannot reach), and a setting ggjbrowse cannot draw (facets on a feature
track) land in the script header.

## Settled decisions

- **ggjbrowse is the product; the export is a doorway to it.** R users start in
  R, and the browser already gives an instant figure (Export SVG); what R adds
  happens in the user's own session. No in-browser R (webR) unless ggjbrowse
  users ask for it. Decided with Colin, 2026-10-11.
- **Readers plus one composing call.** The script holds no layers, scales or
  patchwork of its own: an earlier exporter spelled every panel out in
  TypeScript, reached 100+ lines for three tracks and drifted from
  ggjbrowse's own `autoplot()` (panel heights, band choice). Composition
  lives in ggjbrowse (`jbrowse_stack`), once. The header shows how to restyle
  every band (`fig & ...`, since `+` reaches only the last) and how to take one
  apart, over the script's own track names, with `ggplot2::` spelled out since
  the script attaches only ggjbrowse; `rScriptRun.test.ts` runs both.
- **The engine reads, from the config as written.** A display's written
  config (`getSnapshot`, defaults left out) goes to the reader's `display`
  argument, so a setting the browser gains needs no exporter change and the
  script spells out only what the user set. The exporter passes the adapter as
  a path where ggjbrowse would pick that adapter from the extension, and as its
  config, locations resolved, where the adapter has a setting (a BigBed's
  `aggregateField`, a multi-BigWig's subadapters) or a name hiding its format.
- **Mark displays are not exported.** The hand translator that turned a
  `LinearMarkDisplay` config into ggplot code (markToPlot, transformR, the
  rtracklayer readers; last at 2ecc896d8f) is gone. They come back through an engine marks table built on
  `CoreGetEncodedLayers` / `markLayerRequest` and one generic
  `geom_jbrowse_marks()`, not a port.

## What the script has to hold

- **A feature track exports at the view's `heightMode` and `height`**, read
  off the resolved config, since the written one omits the default `fit`.
  The figure then drops the labels and isoforms the browser drops to fit the
  track, and a reader who wants every label changes one word to `grow`.
  ggjbrowse's own default is `grow`.
- **Every reader takes the view's assembly**, written once as `assembly <- …`
  under `locus`: `jbrowse_assembly()` of its sequence and alias files where
  ggjbrowse builds the same config from their paths, else the config as an R
  list. The engine reads each file under that file's spelling of a contig, so
  every reader takes the view's canonical `locus`, and a CRAM decodes against
  the assembly's sequence.
- **`width` is the view's pixels** (`bp / bpPerPx`), and every reader takes
  it, so a feature or quantitative track resolves its labels, chevrons and
  BigWig zoom level as the view did, and the pileup and variant matrix fade
  as it did. The script sets it once, as `width <- N` under `locus`, so a
  reader after a narrower figure edits one number.
- **The figure is as tall as the view's bands and as wide as its pixels.**
  `ggsave()` takes `jbrowse_height(fig)`, which measures the stack's bands at
  the display's pixels, a compact pileup included, and its keys, rather than a
  height per track kind in the exporter. `jbrowse_width(fig)` gives the width
  at the same 150 px an inch: a 2,500 px view saved 10 inches wide drew its
  feature labels at 3 pt, since a label takes the panel's smaller scale.
- **The script checks its ggjbrowse.** `GGJBROWSE_VERSION` is the release
  whose readers and `jbrowse_stack` it calls; an older install stops with the
  install line rather than an "unused argument" error.

## Verify a change

- `npx jest plugins/linear-genome-view/src/LinearGenomeView/rExport`.
  `rScriptRun.test.ts` runs each emitted script under Rscript, figure and
  all, and asserts on what its tracks read; it skips without R and
  ggjbrowse, except under `REQUIRE_R=1` (the `R export` workflow, on a push
  touching `rExport/` and nightly against ggjbrowse's main).
- Drive the real app too: the dev server
  (`products/jbrowse-web/scripts/start.ts` under `NODE_ENV=development`,
  run from `products/jbrowse-web`), a volvox view, the menu item, `Rscript` on the download, the figure beside
  a screenshot. The live path is where the normalized adapter config,
  aliases and `blob:` files differ from a fixture.
