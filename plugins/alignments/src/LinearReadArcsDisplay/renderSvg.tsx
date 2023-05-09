import React from 'react'

import { getContainingView } from '@jbrowse/core/util'

// locals
import drawFeats from './drawFeats'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

import { LinearReadArcsDisplayModel } from './model'

// stabilize clipid under test for snapshot
function getId(id: string) {
  const isJest = typeof jest === 'undefined'
  return `arc-clip-${isJest ? id : 'jest'}`
}

export async function renderReadArcSvg(
  self: LinearReadArcsDisplayModel,
  opts: { rasterizeLayers?: boolean },
) {
  const view = getContainingView(self) as LinearGenomeViewModel
  const width = view.dynamicBlocks.totalWidthPx
  const height = self.height
  let str
  if (opts.rasterizeLayers) {
    const canvas = document.createElement('canvas')
    canvas.width = width * 2
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.scale(2, 2)
    drawFeats(self, ctx)
    str = (
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
    drawFeats(self, ctx)
    const clipid = getId(self.id)
    str = (
      <>
        <defs>
          <clipPath id={clipid}>
            <rect x={0} y={0} width={width} height={height} />
          </clipPath>
        </defs>
        <g
          /* eslint-disable-next-line react/no-danger */
          dangerouslySetInnerHTML={{
            __html: ctx.getSvg().innerHTML,
          }}
          clipPath={`url(#${clipid})`}
        />
      </>
    )
  }

  return <>{str}</>
}
