import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { getStrokeProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { staticBlocksDx, vlinePath } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

export default function SVGGridlines({
  model,
  height,
}: {
  model: LGV
  height: number
}) {
  const { gridlineTicks, width } = model
  const theme = useTheme()
  // share the on-screen gridline colors; getStrokeProps splits the rgba alpha
  // into strokeOpacity so the exported SVG stays renderer-safe
  const minor = getStrokeProps(theme.palette.gridlineMinor)
  const major = getStrokeProps(theme.palette.gridlineMajor)
  const dx = staticBlocksDx(model)
  const xs = (wantMajor: boolean) =>
    gridlineTicks.filter(t => t.major === wantMajor).map(t => dx + t.x)

  // gridlineTicks spans the whole staticBlocks frame, which overhangs the
  // viewport on both sides, so clip to the view width rather than letting ticks
  // bleed into the export margin
  return (
    <SvgClipRect id={`gridline-clip-${model.id}`} width={width} height={height}>
      <path
        d={vlinePath(xs(false), 0, height)}
        strokeWidth={1}
        fill="none"
        {...minor}
      />
      <path
        d={vlinePath(xs(true), 0, height)}
        strokeWidth={1}
        fill="none"
        {...major}
      />
    </SvgClipRect>
  )
}
