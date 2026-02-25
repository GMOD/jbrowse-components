import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function getId(id: string) {
  const isJest = typeof jest === 'undefined'
  return `arc-clip-${isJest ? id : 'jest'}`
}

type LGV = LinearGenomeViewModel

export function renderSvg<T extends { id: string; height: number }>(
  self: T,
  opts: { rasterizeLayers?: boolean },
  cb: (
    model: T,
    ctx: CanvasRenderingContext2D | SvgCanvas,
    width: number,
    height: number,
  ) => void,
) {
  const view = getContainingView(self) as LGV
  const width = view.dynamicBlocks.totalWidthPx
  const height = self.height
  if (opts.rasterizeLayers) {
    const canvas = document.createElement('canvas')
    canvas.width = width * 2
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.scale(2, 2)
    cb(self, ctx, width, height)
    return (
      <image
        width={width}
        height={height}
        xlinkHref={canvas.toDataURL('image/png')}
      />
    )
  } else {
    const ctx = new SvgCanvas()
    cb(self, ctx, width, height)
    const clipid = getId(self.id)
    return (
      <>
        <defs>
          <clipPath id={clipid}>
            <rect x={0} y={0} width={width} height={height} />
          </clipPath>
        </defs>
        <g
          dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }}
          clipPath={`url(#${clipid})`}
        />
      </>
    )
  }
}
