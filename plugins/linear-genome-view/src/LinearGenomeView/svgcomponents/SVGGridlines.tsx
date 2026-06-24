import { getStrokeProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import BlockClipGroup from './BlockClipGroup.tsx'
import { makeBlockTicks } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

export default function SVGGridlines({
  model,
  height,
}: {
  model: LGV
  height: number
}) {
  const {
    dynamicBlocks: { contentBlocks },
    offsetPx: viewOffsetPx,
    bpPerPx,
  } = model
  const theme = useTheme()
  // share the on-screen gridline colors; getStrokeProps splits the rgba alpha
  // into strokeOpacity so the exported SVG stays renderer-safe
  const minor = getStrokeProps(theme.palette.gridlineMinor)
  const major = getStrokeProps(theme.palette.gridlineMajor)

  return (
    <>
      {contentBlocks.map(block => (
        <BlockClipGroup
          key={block.key}
          block={block}
          viewOffsetPx={viewOffsetPx}
          height={height}
          idPrefix={`gridline-clip-${model.id}`}
        >
          {makeBlockTicks(block, bpPerPx).map(({ base, type, x }) => (
            <line
              key={`gridline-${base}`}
              x1={x}
              x2={x}
              y1={0}
              y2={height}
              strokeWidth={1}
              {...(type === 'major' ? major : minor)}
            />
          ))}
        </BlockClipGroup>
      ))}
    </>
  )
}
