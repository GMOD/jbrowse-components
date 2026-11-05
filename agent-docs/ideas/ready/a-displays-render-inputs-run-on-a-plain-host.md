---
name: a-displays-render-inputs-run-on-a-plain-host
description: "The getters that turn a display's settings and fetched data into its painter's inputs are written once over a duck-typed host: the model installs them as a views layer, and a static export runs the same getters over a plain object. Wiggle's color, mark sources, drawn extent and gpuProps are built (wiggleResolveViews) and tables.ts runs them. Left for jb2export with no session: plot geometry, renderState, axes and the sidebar on the plain host, and renderDisplaySvg's MST-node contract. Alignments after."
---

# A display's render inputs run on a plain host

Colin (2026-11-02) wants jb2export to be a predictable static export rather than
a headless boot of the interactive app. Drawing it from `@jbrowse/tables` was
considered and declined: tables stop at data plus the display's decisions, so
jb2export would need a second drawer per display, and the tables already
disagree with the view in places
([a-tables-export-calls-the-models-decisions](a-tables-export-calls-the-models-decisions.md)).

## The shape

The painters are already pure: `drawAlignmentsToCtx` takes plain sources and
render state, and wiggle's `renderSvg` takes a duck-typed `RenderSvgModel`. The
resolve step that feeds them is a chain of model getters.

That chain is written as a function from a duck-typed host to an object of
getters, as `wiggleDisplayViews` already was:

- **The model** installs it with `.views(self => wiggleResolveViews(self))`, so
  each getter is its own computed and memoizes exactly as before.
- **A static export** builds a plain host from the config and the fetched
  results and reads the same getters off `wiggleResolveViews(host)`. A host
  value that depends on a view (`rowPaletteDeals` reads `rowColorPaintsMarks`)
  is a lazy getter closing over the views object.

One pure function per display, `resolveX({ conf, results, … })` called by the
model, was the first proposal and is not the shape: a model getter calling it
recomputes the whole chain whenever any input moves, so a row-color edit would
re-walk the autoscale stats.

## Built: wiggle's color and mark sources

`plugins/wiggle/src/shared/wiggleResolveViews.ts` holds `effectiveExtent`, the
color chain (`effectiveColor` → `colorEncoding` → `wiggleColor` →
`markColoring`), `rowColorPaintsMarks`, `markSources`, `scoreRuleValues`,
`autoscaleSourceNames` and `gpuProps`, with `wiggleAutoscaleRange` as the pure
step from walked stats to range. `tables.ts` runs them, and running them closed
a real drift: the tables autoscaled over every source while the view autoscales
over the rows drawn, so a `rows.kept` or `rows.filter` export got a wider score
domain than the screen (pinned in `packages/tables/src/wiggle.test.ts`).

## Left

- **The rest of wiggle's chain on the plain host**: `plotGeometry`,
  `rowsHeight`, `numRows` and `effectiveRowHeight` (model getters today), then
  `wiggleDisplayViews`' `renderState`, which is already duck-typed, and
  `ScoreAxisMixin`'s `axes` and `autoscaledDomain`, whose group union has no
  meaning for one track and needs a pure `range → domain` step the mixin and the
  host both call.
- **The SVG shell's contract**: `renderDisplaySvg` takes an `LgvSvgExportable`,
  which extends `IStateTreeNode`, so `WiggleSvgBody` cannot render from a plain
  host until the shell takes its view and height as arguments.
- **The rows**: `tables.ts` still composes `arrangeRows` → `withRowColors` →
  `narrowRows` by hand where the model gets them from `TreeSidebarMixin`. The
  same move there (the mixin's row getters over a duck-typed host) would serve
  every row display's tables, variants included.
- **Alignments**, whose chain is the longest (`renderState`, `sourceSections`,
  `renderSections` in `LinearAlignmentsDisplay/model.ts`).

## Not this

- jb2export drawing from tables: a second drawer.
- One resolve function per display called by the model's getters: it loses the
  per-getter memo (above).
- Making `launchTrack` throw so a caller sees failures: click handlers rely on
  its toast-and-undefined contract. Failures reach a headless caller as
  `view.problems` instead (`BaseViewModel`, filled by `getNotificationSink`).
