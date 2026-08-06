import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import SVGRuler from './SVGRuler.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

// The compact header a *stacked* export gives each of its rows: the assembly
// name and the ruler, nothing else. The standalone LGV export fills the same
// slot in SVGView with SVGHeader, which additionally draws the cytoband
// overview and the total-bp scalebar — there is room for those above a single
// view, and none between two rows of a synteny stack.
export default function SVGRowHeader({
  view,
  fontSize,
  // Must be the height the caller also passes SVGView as `contentTop`: the
  // ruler hangs its ticks off the bottom of this budget so they meet the
  // tracks, and the tracks start at `contentTop`.
  rulerHeight,
}: {
  view: LinearGenomeViewModel
  fontSize: number
  rulerHeight: number
}) {
  const theme = useTheme()
  return (
    <>
      {/*
        The group's origin (y=0) is the top of the ruler. The assembly label
        uses the default alphabetic baseline (glyphs ascend above y=0) so it
        floats into the fontSize-tall band that the caller reserves *above*
        this component — synteny/breakpoint each offset the whole view by
        +fontSize for exactly this. Don't switch to dominantBaseline="hanging"
        without also reworking those callers' offsets, or the label collides
        with the ruler.
      */}
      <text
        x={0}
        fontSize={fontSize}
        fill={stripAlpha(theme.palette.text.primary)}
      >
        {view.assemblyNames.join(', ')}
      </text>
      <SVGRuler model={view} rulerHeight={rulerHeight} />
    </>
  )
}
