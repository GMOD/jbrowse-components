Human and mouse at _BRCA1_, with UCSC's hg38→mm39 liftOver between them. Drag
either row — they move independently, and the ribbons follow.

Almost nothing here is new. A `LinearSyntenyView` holds **ordinary linear genome
views** in `views`, so every page above applies to each row unchanged:
`useWidthSetter`, `usePanZoom`, `getTrack(id).activeDisplay.RenderingComponent`.
Each row carries a plain RefSeq `FeatureTrack` — the same config it was five
pages ago, twice, because there are two genomes.

What the synteny view adds is `levels` — one band between each pair of rows.
`LevelSyntenyCanvas` draws that band's ribbons on the same GPU backend the rest
of JBrowse renders with, and is the single piece here you could not write
yourself. The interactive half — tooltip, right-click menu, fetch status — is
the per-display `RenderingComponent`, off the model like a track's.

The alignment is a **PIF**: a PAF sorted and indexed on both sides, so the view
fetches only what covers the window instead of the whole file.
`jbrowse make-pif` builds one from any PAF; the index here is a `.csi`, hence
`csi: true`.

Two `init` fields decide how it reads. `drawCurves: true` bends the ribbons,
which matters once the rows are offset and every chord is on a slant.
`cigarMode: 'matches'` leaves the indel wedges see-through, so the conserved
exons are what you see.

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
