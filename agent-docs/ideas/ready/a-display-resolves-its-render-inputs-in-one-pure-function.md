---
name: a-display-resolves-its-render-inputs-in-one-pure-function
description: "A display's painter is already pure, but the step that turns config, viewport, fetched data and palette into its inputs lives in MST computeds, and each tables.ts copies it by hand. Lifting that step into one pure function per display, called by the model, the tables export and a static export, makes jb2export fetch → resolve → paint with no session, and stops the tables drifting. First slice: wiggle."
---

# A display resolves its render inputs in one pure function

Colin (2026-11-02) wants jb2export to be a predictable static export rather than
a headless boot of the interactive app. Drawing it from `@jbrowse/tables` was
considered and declined: tables stop at data plus the display's decisions, so
jb2export would need a second drawer per display, and the tables already
disagree with the view in places
([a-tables-export-calls-the-models-decisions](a-tables-export-calls-the-models-decisions.md)).

## What is pure and what is not

- **The painters are pure.** `drawAlignmentsToCtx(ctx, sources, blocks, state)`
  (`plugins/alignments/src/LinearAlignmentsDisplay/renderers/Canvas2DAlignmentsRenderer.ts`)
  takes plain sources and render state. Wiggle's and features' `renderSvg`
  take a duck-typed `RenderSvgModel` of data maps, `renderState` and a few
  flags, not the MST model.
- **The resolve step is not.** What feeds the painter (autoscale, row colors,
  `renderState`, `gpuProps`, plot geometry, axes) is a chain of MST computeds
  on the model. `plugins/wiggle/src/tables.ts` re-spells that chain
  (`resolveRowColors`, `dealValueColors`, `buildSourceRenderData`) to make its
  tables, which is the drift the ideas doc above lists.

## The change

Per display, one pure function from `{ conf, results, regions, bpPerPx, width,
palette }` to the painter's inputs. The model's computeds call it, `tables.ts`
calls it, and a static export calls it. jb2export then becomes: fetch through
the same worker RPC, resolve, paint, with no session, autoruns or launch waits.

## First slice: wiggle

`resolveWiggleRender({ conf, results, regions, bpPerPx, width, palette })`
returning `{ renderState, gpuProps, plotGeometry, axes, svgSidebar }`.
`WiggleSvgBody` renders from it in a test with no MST model, and the measure is
`wiggle/src/tables.ts` shrinking to a call plus the flattening. Alignments,
whose resolve chain is the longest (`LinearAlignmentsDisplay/model.ts`
`renderState`, `sourceSections`, `renderSections`), comes after wiggle shows
the shape.

## Not this

- jb2export drawing from tables: a second drawer.
- Making `launchTrack` throw so a caller sees failures: click handlers rely on
  its toast-and-undefined contract. Failures reach a headless caller as
  `view.problems` instead (`BaseViewModel`, filled by `getNotificationSink`).
