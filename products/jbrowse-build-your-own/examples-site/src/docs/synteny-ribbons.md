Human and mouse at _BRCA1_, with UCSC's hg38→mm39 liftOver between them. Drag
either row — they move independently, and the ribbons follow.

Almost nothing here is new. A `LinearSyntenyView` holds **ordinary linear genome
views** in `views`, so every page above applies to each row unchanged:
`useWidthSetter`, `usePanZoom`, `getTrack(id).activeDisplay.RenderingComponent`.
Each row carries a plain RefSeq `FeatureTrack` — the same config it was five
pages ago, twice, because there are two genomes.

What the synteny view adds is `levels` — one band between each pair of rows.
`LevelSyntenyCanvas` draws that band's ribbons, and it is the single piece here
you could not write yourself: it drives the same GPU backend the rest of JBrowse
renders with. The interactive half — tooltip, right-click menu, fetch status —
is the per-display `RenderingComponent`, which comes off the model like a
track's does.

The alignment is a **PIF**: a PAF sorted and indexed on both sides, so the view
fetches only what covers the window rather than reading a whole-genome alignment
into memory. `jbrowse make-pif` builds one from any PAF, and the index here is a
`.csi`, hence `csi: true`.

## A different package for the engine

```tsx
import { createViewState } from '@jbrowse/react-app2'
```

Every other page imports `@jbrowse/react-linear-genome-view2`, whose session has
exactly one view slot, welded to `LinearGenomeView` — it is the single-view
product and that is the point of it. Two views need a session whose views are an
array, which is `@jbrowse/react-app2`.

Width is set once, on the synteny view: `setWidth` fans out, so rows cannot
disagree about how wide they are. Panning is bound per row instead, which is
what lets them move independently.
