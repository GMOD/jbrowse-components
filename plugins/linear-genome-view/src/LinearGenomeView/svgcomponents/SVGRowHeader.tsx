import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import SVGRuler from './SVGRuler.tsx'
import SVGScalebar from './SVGScalebar.tsx'
import { getRowHeaderLayout } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

// The compact header a *stacked* export gives each of its rows: the assembly
// name, optionally the total-bp scalebar, and the ruler. The standalone LGV
// export fills the same slot in SVGView with SVGHeader, which additionally
// draws the cytoband overview — there is room for that above a single view, and
// none between two rows of a synteny stack.
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
  // Whether this row draws the capped bar labelled with its span. Off by
  // default, since it costs `getRowHeaderLayout().bandHeight` of the caller's
  // band and every caller has to reserve that much before asking for it. See
  // getRowHeaderLayout for what it is for.
  showScalebar = false,
}: {
  view: LinearGenomeViewModel
  fontSize: number
  rulerHeight: number
  showAssemblyName?: boolean
  showScalebar?: boolean
}) {
  const theme = useTheme()
  const { assemblyLabelBaselineY, scalebarLineY } = getRowHeaderLayout({
    fontSize,
    showScalebar,
  })
  return (
    <>
      {/*
        The group's origin (y=0) is the top of the ruler. Everything above it is
        drawn at negative y, into the band the caller reserves — synteny and
        breakpoint each offset the whole view by that much for exactly this. The
        assembly label uses the default alphabetic baseline, so `y` is where its
        glyphs sit rather than where its box starts; getRowHeaderLayout resolves
        that from the same ink-box model the band is measured with. Don't switch
        to dominantBaseline="hanging" without reworking both.
      */}
      {showAssemblyName ? (
        <text
          x={0}
          y={assemblyLabelBaselineY}
          fontSize={fontSize}
          fill={stripAlpha(theme.palette.text.primary)}
        >
          {view.assemblyNames.join(', ')}
        </text>
      ) : null}
      {scalebarLineY === undefined ? null : (
        <g transform={`translate(0 ${scalebarLineY})`}>
          <SVGScalebar model={view} fontSize={fontSize} />
        </g>
      )}
      <SVGRuler model={view} rulerHeight={rulerHeight} />
    </>
  )
}
