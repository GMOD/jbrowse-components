import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'

import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

// Shared wrapper for SVGRuler/SVGGridlines: translates content to its
// screen-space position and clips it to the block width so per-block content
// can't bleed into neighbors.
export default function BlockClipGroup({
  block,
  viewOffsetPx,
  height,
  idPrefix,
  children,
}: {
  block: ContentBlock
  viewOffsetPx: number
  height: number
  idPrefix: string
  children: React.ReactNode
}) {
  return (
    <g transform={`translate(${block.offsetPx - viewOffsetPx} 0)`}>
      <SvgClipRect id={`${idPrefix}-${block.key}`} width={block.widthPx} height={height}>
        {children}
      </SvgClipRect>
    </g>
  )
}
