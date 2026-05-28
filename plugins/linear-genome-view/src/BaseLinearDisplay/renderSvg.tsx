import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  ReactRendering,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { blockToRegion } from '@jbrowse/core/util/blockTypes'
import CompositeMap from '@jbrowse/core/util/compositeMap'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/core/util/svgExport'
import { when } from 'mobx'

import SVGLegend from './SVGLegend.tsx'
import {
  collectLayoutsFromRenderings,
  deduplicateFeatureLabels,
} from './components/util.ts'
import { SvgFloatingLabels } from './models/SvgFloatingLabels.tsx'
import BlockState, {
  renderBlockData,
} from './models/serverSideRenderedBlock.ts'
import { getId } from './models/util.ts'

import type { BaseLinearDisplayModel } from './model.ts'
import type { ExportSvgDisplayOptions, LayoutRecord } from './types.ts'
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
  const { offsetPx: viewOffsetPx, roundedDynamicBlocks, width, bpPerPx } = view

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
          theme: opts.theme ?? renderProps.theme,
        }),
      ] as const
    }),
  )

  const layoutMaps = collectLayoutsFromRenderings(renderings)
  const layoutFeatures = new CompositeMap<string, LayoutRecord>(layoutMaps)

  const { assemblyManager } = getSession(self)
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined
  const featureLabels = deduplicateFeatureLabels(
    layoutFeatures,
    view,
    assembly,
    bpPerPx,
  )

  const labelsClipId = getId(id, 'labels')
  const theme = createJBrowseTheme(opts.theme)
  const legendItems = self.showLegend ? self.legendItems(theme) : []

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
      {/* Floating labels share one clip across the whole view */}
      <SvgClipRect id={labelsClipId} width={width} height={blockHeight}>
        <SvgFloatingLabels
          featureLabels={featureLabels}
          offsetPx={viewOffsetPx}
          viewWidth={width}
        />
      </SvgClipRect>
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
