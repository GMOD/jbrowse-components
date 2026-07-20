import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { getStrokeProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { gridlineTickXs, vlinePath } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

export default function SVGGridlines({
  model,
  height,
}: {
  model: LGV
  height: number
}) {
  const { width } = model
  const theme = useTheme()
  // share the on-screen gridline colors; getStrokeProps splits the rgba alpha
  // into strokeOpacity so the exported SVG stays renderer-safe
  const minorProps = getStrokeProps(theme.palette.gridlineMinor)
  const majorProps = getStrokeProps(theme.palette.gridlineMajor)
  const { major, minor } = gridlineTickXs(model)

  // gridlineTicks spans the whole staticBlocks frame, which overhangs the
  // viewport on both sides, so clip to the view width rather than letting ticks
  // bleed into the export margin
  return (
    <SvgClipRect id={`gridline-clip-${model.id}`} width={width} height={height}>
      <path
        d={vlinePath(minor, 0, height)}
        strokeWidth={1}
        fill="none"
        {...minorProps}
      />
      <path
        d={vlinePath(major, 0, height)}
        strokeWidth={1}
        fill="none"
        {...majorProps}
      />
    </SvgClipRect>
  )
}
