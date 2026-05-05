# Active Work Items

**Updated:** 2026-04-25 | PRD.md holds invariants; this file is the categorized backlog.


---


## Config migration

On going 'back compat'. needs deep dive. We removed entire concept of renderer, so, example

**PileupRenderer → display-level config.** Old configs with
`configuration.renderer.type === 'PileupRenderer'` silently drop
`featureHeight`, `featureSpacing`, `maxHeight`, `colorBy`, `filterBy`. Add
`migrateDisplayConfiguration()` and wire into the snapshot migration path.
Verify `config_demo.json` and `volvox/config.json` load with JEXL color
expressions intact. See `CONFIG_PATTERN.md`.

---


## Complex issues

**Scroll zoom lag.** This is a tricky one but sometimes, when doing a scroll zoom, we see a ~500ms–1s delay after tab switch. Debug LinearGenomeView reactivity or JS event throttling.



### Alignments

**Samplot mode follow-ups.** Phase 1+2 landed (flat lines, Y = |tlen|, SV-type
palette, shared Canvas2D ⇄ SVG rasterizer). Remaining:


- *Discardable samplot strand fallback.* `getSamplotColorIndex`'s
  strand-only branch (split reads with no `pairOrientationNum`) collapses
  to same-strand→INV, else→DEL. Proper DUP classification for split reads
  requires reading query order + genomic order together; left un-wired
  because the rare case has limited signal-to-noise.
- *Endpoint markers.* samplot.py draws square markers (`marker="s"`) at both
  ends of paired-read lines and circle markers (`marker="o"`) at split-read
  line ends. Would require generating extra geometry per arc instance in the
  shader (a small square/circle quad at each x1/x2). Canvas2D path would use
  `ctx.fillRect` / `ctx.arc`. Medium scope; skip until visual need is confirmed.
- *Line width: split vs paired.* samplot.py uses `lw=1` for split reads and
  `lw=0.5` for paired reads. Currently both use the same `arcLineWidth`
  uniform. Could pass per-instance width or use two separate draw calls.
  Low visual impact; defer.
- *Y-axis domain margin.* samplot.py uses `ylim_margin = max(1.02 + jitter_bounds, 1.10)`
  (percentage-based, adjusts for jitter). JBrowse uses a fixed 8 px pixel margin
  (`ARC_HEIGHT_MARGIN`). Minor visual difference; defer.


## Canvas

- Canvas: right-side padding excessive? Subpixel drawing crowded at dense zoom?


## Remove graph stuff from this branch including jbrowse-cli related changes

we iterated on this but it needs to be removed before merger
plugins/tube-map and plugins/graph remove
put these on a new branch though





## Linear synteny view

Moves around slightly during zoom, audit pixel usage


## Difference between 'fullyDrawn' vs 'canvasDrawn'



## Chevrons in plugins/canvas look bad webgpu/webgl (looks sorta pixelated, not clean, ideally a bit more subtle) and canvas (slightly bolder in canvas, ideally more subtle)


## After 'gene name' is in refnameautocomplete, can't select chr names anymore
