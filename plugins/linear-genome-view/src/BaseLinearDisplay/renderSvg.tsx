import { ReactRendering, getContainingView } from '@jbrowse/core/util'
import { blockToRegion } from '@jbrowse/core/util/blockTypes'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/core/util/svgExport'
import { when } from 'mobx'

import SVGLegend from './SVGLegend.tsx'
import BlockState, {
  renderBlockData,
} from './models/serverSideRenderedBlock.ts'
import { getId } from './models/util.ts'

import type { BaseLinearDisplayModel } from './model.ts'
import type { ExportSvgDisplayOptions } from './types.ts'
import type { LinearGenomeViewModel } from '../LinearGenomeView/index.ts'

export async function renderBaseLinearDisplaySvg(
  self: BaseLinearDisplayModel,
  opts: ExportSvgDisplayOptions,
) {
  // Block-rendered SVG pulls from `renderProps()` which stays
  // `notReady: true` until the feature-density stats are computed.
  // Wait here so the export path is self-contained.
  await when(() => !self.renderProps().notReady || !!self.error)

  const { height, id } = self
  const { overrideHeight } = opts
  const view = getContainingView(self) as LinearGenomeViewModel
  const { offsetPx: viewOffsetPx, roundedDynamicBlocks, width } = view

  if (self.error) {
    return <SVGErrorBox error={self.error} width={width} height={height} />
  }

  const renderings = await Promise.all(
    roundedDynamicBlocks.map(async block => {
      const region = blockToRegion(block)
      const blockState = BlockState.create({
        key: block.key,
        region,
      })

      // regionCannotBeRendered can return jsx so look for plaintext version
      const cannotBeRenderedReason =
        self.regionCannotBeRenderedText(region) ||
        self.regionCannotBeRendered(region)

      if (cannotBeRenderedReason) {
        return [
          block,
          {
            reactElement: (
              <>
                <rect
                  x={0}
                  y={0}
                  width={block.widthPx}
                  height={20}
                  fill="#aaa"
                />
                <text x={0} y={15}>
                  {cannotBeRenderedReason}
                </text>
              </>
            ),
          },
        ] as const
      }

      const blockData = renderBlockData(blockState, self)
      const {
        rpcManager,
        renderArgs,
        renderProps,
        renderingProps,
        rendererType,
        displayError,
      } = blockData
      if (displayError || !renderProps || !rendererType) {
        throw displayError instanceof Error
          ? displayError
          : new Error(`${displayError || 'Unknown'}`)
      }

      return [
        block,
        await rendererType.renderInClient(rpcManager, {
          ...renderArgs,
          ...renderProps,
          renderingProps,
          exportSVG: opts,
          // SVG export always supplies opts.theme (the view resolves it from the
          // selected themeName); the renderer ignores theme regardless.
          theme: opts.theme,
        }),
      ] as const
    }),
  )

  const legendItems = self.showLegend ? self.legendItems() : []

  const blockHeight = overrideHeight ?? height
  return (
    <>
      {renderings.map(([block, rendering]) => {
        const { key, offsetPx, widthPx } = block
        const offset = offsetPx - viewOffsetPx
        return (
          <g key={key} transform={`translate(${offset} 0)`}>
            <SvgClipRect
              id={getId(id, key)}
              width={widthPx}
              height={blockHeight}
            >
              <ReactRendering rendering={rendering} />
            </SvgClipRect>
          </g>
        )
      })}
      {legendItems.length > 0 ? (
        <SVGLegend
          items={legendItems}
          width={width}
          legendAreaWidth={opts.legendWidth}
        />
      ) : null}
    </>
  )
}
