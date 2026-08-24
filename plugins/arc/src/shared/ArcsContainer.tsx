import { getContainingView, getSession } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Everything the two arc displays' `Arcs` components had in common, which was
// everything except the glyph: resolve the assembly the arcs are placed against,
// and decide what the arcs are wrapped in.
//
// **The wrapper is the load-bearing half.** On screen the display body owns its
// own `<svg>`; on the export path the shell has already opened one
// (renderDisplaySvg → SvgChrome → renderArcSvg's SvgClipRect), so a second would
// nest and clip the arcs to a box inside the box they were laid out in. That is
// one fact about this plugin and it was written twice, in the two files least
// likely to be read together.
//
// A render prop rather than an `Arc` component prop, the same shape
// `DisplayChrome` uses: the caller keeps its own concrete model type and its own
// per-glyph props (`semicircle`/`selected` for one, `lineWidth` for the other),
// and this stays ignorant of both. What it does resolve is what both need and
// neither should subscribe to per arc: the assembly, the view, and the color a
// hovered arc takes.
const ArcsContainer = observer(function ArcsContainer({
  model,
  exportSVG,
  children,
}: {
  model: ArcDisplayModel
  exportSVG?: boolean
  children: (
    assembly: Assembly,
    view: LinearGenomeViewModel,
    hoverColor: string,
  ) => React.ReactNode
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const { assemblyManager } = getSession(model)
  const assembly = assemblyManager.get(view.assemblyNames[0]!)
  // contrasts against the track background in either theme
  const hoverColor = useTheme().palette.text.primary

  if (!assembly) {
    return null
  }

  const arcs = children(assembly, view, hoverColor)
  return exportSVG ? (
    <>{arcs}</>
  ) : (
    <svg width={model.canvasWidth} height={model.height}>
      {arcs}
    </svg>
  )
})

export default ArcsContainer
