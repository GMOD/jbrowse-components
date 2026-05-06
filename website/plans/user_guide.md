# User guide / config guide plan

## displays config section (tracks.md)

- `tracks.md` is 43 lines and never mentions the `displays` array
- Add explanation of what `displays` is, the `displayId` naming convention
  (`{trackId}-{displayType}`), and examples overriding height and color
- Code improvement: `preprocessSnapshot` could auto-generate `displayId` when
  absent, eliminating a major class of config errors

## SV inspector breakpoint split view

- After clicking "Open breakpoint split view" from the SV inspector table, the
  resulting view opens with no tracks loaded — user must open them manually
- Add a note in `sv_inspector_view.md` explaining this step

## Paired BEDPE display

- No user-facing docs explain loading BEDPE in the LGV to get the arc/paired
  display (distinct from the SV inspector tabular use)
- Add a section in `sv_visualization.md` showing: open track → BEDPE file →
  which display appears and what it looks like
- Verify whether the "Add track" dialog auto-selects the paired display for
  BEDPE; if it defaults to a plain feature track instead, that is a UX bug

## bedMethyl / BED as multi-wiggle (multiquantitative_track.md)

- Add a config example showing how to load a `.bed` or `.bedMethyl` file as a
  `MultiWiggleAdapter` subadapter using `BedTabixAdapter`
- Code improvement: auto-detect `.bedMethyl` extension in `guessAdapterFromFileName`
  and route it to `MultiWiggleAdapter`, letting users open it via the UI

## CLI synteny formats

- `cli.md` has PIF docs but loading different synteny formats (PAF, delta,
  anchors, chain) via `jbrowse add-track` is not shown
- Add examples to the CLI docs or synteny config guide

## Connections user guide

- Connections (UCSC track hubs, JBrowse 1 data directories) get one sentence
  in `basic_usage.md` and nothing else
- Add a section explaining what connections are, how to open one via
  `File → Open connection`, and what a UCSC track hub URL looks like

## Variation track color example

- Add a jexl color-by-variant-type example to the variant track config guide
- Reference: https://github.com/GMOD/jbrowse/issues/937#issuecomment-1534326753

## Quickstart TLDR + example files

- `quickstart_web.md` has no summary; readers can't scan it quickly
- Add a shell-script block at the top showing the full workflow in ~10 lines
- Link to small downloadable example files users can actually run the commands with

## Dropbox/Google Drive tutorial (issue #3280)

- No user guide for opening files from Dropbox or Google Drive
- Add a tutorial covering the current UI flow
- Code improvements that would reduce the need for docs:
  - Auto-detect Dropbox URLs and pre-select the internet accounts button
  - Sort adapter type dropdown alphabetically
  - Infer filename from Dropbox URL to improve adapter type guessing

## Cross-regional visualizations

- Features like read arcs, chord display, and breakpoint split view that show
  inter-regional data are scattered across several pages with no unifying entry point
- Either add a dedicated page or add a summary section in the user guide index
  with links to each relevant section
