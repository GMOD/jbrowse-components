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
  // Whether this row draws its assembly name. Default true, which is what a
  // stack of DIFFERENT assemblies wants — a synteny export names each row
  // because each row is a different genome. A breakpoint split view is usually
  // one assembly seen at several loci, and there the name is the same string
  // printed once per panel, so that caller passes false on every row after the
  // first whose assembly matches the row above it. The reserved band above the
  // ruler is unchanged either way: it is the caller's offset, not this
  // component's.
  showAssemblyName = true,
}: {
  view: LinearGenomeViewModel
  fontSize: number
  rulerHeight: number
  showAssemblyName?: boolean
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
      {showAssemblyName ? (
        <text
          x={0}
          fontSize={fontSize}
          fill={stripAlpha(theme.palette.text.primary)}
        >
          {view.assemblyNames.join(', ')}
        </text>
      ) : null}
      <SVGRuler model={view} rulerHeight={rulerHeight} />
    </>
  )
}
