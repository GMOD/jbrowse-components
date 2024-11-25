import React from 'react'
import { getContainingView } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// stabilize clipid under test for snapshot
function getId(id: string) {
  const isJest = typeof jest === 'undefined'
  return `arc-clip-${isJest ? id : 'jest'}`
}

type LGV = LinearGenomeViewModel

export async function renderSvg<T extends { id: string; height: number }>(
  self: T,
  opts: { rasterizeLayers?: boolean },
  cb: (
    model: T,
    ctx: CanvasRenderingContext2D,
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
    // @ts-ignore
    const C2S = await import('canvas2svg')
    const ctx = new C2S.default(width, height)
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
          dangerouslySetInnerHTML={{ __html: ctx.getSvg().innerHTML }}
          clipPath={`url(#${clipid})`}
        />
      </>
    )
  }
}
