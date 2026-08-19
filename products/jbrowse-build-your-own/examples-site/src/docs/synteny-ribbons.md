Human and mouse at _BRCA1_, with UCSC's hg38→mm39 liftOver between them. Drag
either row. They move independently, and the ribbons follow.

Almost nothing here is new. A `LinearSyntenyView` holds ordinary linear genome
views in `views`, so every page above applies to each row unchanged:
`useWidthSetter`, `usePanZoom`, `getTrack(id).activeDisplay.RenderingComponent`.
The outer view answers `view.status` with the same four values, so the gate is
the same one too — and here it earns its keep, since `initialized` waits on
every row and a failure in either assembly leaves it false for good. What it
adds is `levels`: one band between each pair of rows, drawn by
`LevelSyntenyCanvas` on the same GPU backend the rest of JBrowse renders with.

The alignment is a **PIF**: a PAF sorted and indexed on both sides, so the view
fetches only what covers the window. `jbrowse make-pif` builds one from any PAF.
The index here is a `.csi`, hence `csi: true`. `drawCurves: true` bends the
ribbons, which matters once the rows are offset. `cigarMode: 'matches'` leaves
the indel wedges see-through.

## A different package for the engine

```tsx
import { createViewState } from '@jbrowse/react-app2'
```

Every other page imports `@jbrowse/react-linear-genome-view2`, whose session has
exactly one view slot, welded to `LinearGenomeView`. Two views need a session
whose views are an array, which is `@jbrowse/react-app2`.

Width is set once, on the synteny view: `setWidth` fans out, so rows cannot
disagree about how wide they are. Panning is bound per row, which is what lets
them move independently.
