import { Fragment } from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  ReactRendering,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import CompositeMap from '@jbrowse/core/util/compositeMap'

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
import { ErrorBox } from '../LinearGenomeView/SVGErrorBox.tsx'

import type { BaseLinearDisplayModel } from './model.ts'
import type { ExportSvgDisplayOptions, LayoutRecord } from './types.ts'
import type { LinearGenomeViewModel } from '../LinearGenomeView/index.ts'

export async function renderBaseLinearDisplaySvg(
  self: BaseLinearDisplayModel,
  opts: ExportSvgDisplayOptions,
) {
  const { height, id } = self
  const { overrideHeight } = opts
  const view = getContainingView(self) as LinearGenomeViewModel
  const { offsetPx: viewOffsetPx, roundedDynamicBlocks, width } = view

  if (self.error) {
    return <ErrorBox error={self.error} width={width} height={height} />
  }

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

      const {
        rpcManager,
        renderArgs,
        renderProps,
        renderingProps,
        rendererType,
      } = renderBlockData(blockState, self)

      return [
        block,
        await rendererType.renderInClient(rpcManager, {
          ...renderArgs,
          ...renderProps,
          renderingProps,
          exportSVG: opts,
          theme: opts.theme || renderProps.theme,
        }),
      ] as const
    }),
  )

  // Collect layout data from the renderings for floating labels
  // This is needed because in standalone SVG export (e.g., jbrowse-img),
  // the model's blockState is not populated with rendering results
  const layoutMaps = collectLayoutsFromRenderings(renderings)
  const layoutFeatures = new CompositeMap<string, LayoutRecord>(layoutMaps)

  // Calculate floating label data using the rendering results
  const { assemblyManager } = getSession(self)
  const { offsetPx, bpPerPx } = view
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined
  const featureLabels = deduplicateFeatureLabels(
    layoutFeatures,
    view,
    assembly,
    bpPerPx,
  )

  // Create a clip path ID for the labels that covers the entire view
  const labelsClipId = getId(id, 'labels')

  // Get legend items if legend is enabled
  const theme = createJBrowseTheme(opts.theme)
  const legendItems = self.showLegend ? self.legendItems(theme) : []

  return (
    <>
      {renderings.map(([block, rendering], index) => {
        const { offsetPx, widthPx } = block
        const offset = offsetPx - viewOffsetPx
        const clipid = getId(id, index)

        return (
          <Fragment key={`frag-${index}`}>
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
          </Fragment>
        )
      })}
      {/* Render floating labels with clipping */}
      <defs>
        <clipPath id={labelsClipId}>
          <rect x={0} y={0} width={width} height={overrideHeight || height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${labelsClipId})`}>
        <SvgFloatingLabels
          featureLabels={featureLabels}
          offsetPx={offsetPx}
          viewWidth={width}
        />
      </g>
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
