import React from 'react'
import {
  getContainingView,
  getViewParams,
  ReactRendering,
} from '@jbrowse/core/util'

// locals
import BlockState, { renderBlockData } from './serverSideRenderedBlock'
import { getId } from './util'
import type { BaseLinearDisplayModel } from './BaseLinearDisplayModel'
import type {
  ExportSvgOptions,
  LinearGenomeViewModel,
} from '../../LinearGenomeView'

import type { ThemeOptions } from '@mui/material'

export async function renderBaseLinearDisplaySvg(
  self: BaseLinearDisplayModel,
  opts: ExportSvgOptions & {
    overrideHeight: number
    theme?: ThemeOptions
  },
) {
  const { height, id } = self
  const { overrideHeight } = opts
  const view = getContainingView(self) as LinearGenomeViewModel
  const { offsetPx: viewOffsetPx, roundedDynamicBlocks, width } = view
  const renderings = await Promise.all(
    roundedDynamicBlocks.map(async block => {
      const blockState = BlockState.create({
        key: block.key,
        region: block,
      })

      // regionCannotBeRendered can return jsx so look for plaintext
      // version, or just get the default if none available
      const cannotBeRenderedReason =
        self.regionCannotBeRenderedText(block) ||
        self.regionCannotBeRendered(block)

      if (cannotBeRenderedReason) {
        return [
          block,
          {
            reactElement: (
              <>
                <rect x={0} y={0} width={width} height={20} fill="#aaa" />
                <text x={0} y={15}>
                  {cannotBeRenderedReason}
                </text>
              </>
            ),
          },
        ] as const
      }

      const { rpcManager, renderArgs, renderProps, rendererType } =
        renderBlockData(blockState, self)

      return [
        block,
        await rendererType.renderInClient(rpcManager, {
          ...renderArgs,
          ...renderProps,
          viewParams: getViewParams(self, true),
          exportSVG: opts,
          theme: opts.theme || renderProps.theme,
        }),
      ] as const
    }),
  )

  return (
    <>
      {renderings.map(([block, rendering], index) => {
        const { offsetPx, widthPx } = block
        const offset = offsetPx - viewOffsetPx
        const clipid = getId(id, index)

        return (
          /* biome-ignore lint/suspicious/noArrayIndexKey: */
          <React.Fragment key={`frag-${index}`}>
            <defs>
              <clipPath id={clipid}>
                <rect
                  x={0}
                  y={0}
                  width={widthPx}
                  height={overrideHeight || height}
                />
              </clipPath>
            </defs>
            <g transform={`translate(${offset} 0)`}>
              <g clipPath={`url(#${clipid})`}>
                <ReactRendering rendering={rendering} />
              </g>
            </g>
          </React.Fragment>
        )
      })}
    </>
  )
}
