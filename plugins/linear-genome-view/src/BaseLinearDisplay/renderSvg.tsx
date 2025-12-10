import { Fragment } from 'react'

import {
  ReactRendering,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'

import BlockState, { renderBlockData } from './models/serverSideRenderedBlock'
import { calculateLabelPositions, getId } from './models/util'
import { ErrorBox } from '../LinearGenomeView/SVGErrorBox'

import type { LinearGenomeViewModel } from '../LinearGenomeView'
import type { BaseLinearDisplayModel, ExportSvgDisplayOptions } from './model'

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

  // Calculate label positions for SVG export
  const { assemblyManager } = getSession(self)
  const { offsetPx } = view
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined
  const labelData = calculateLabelPositions(self, view, assembly, offsetPx)

  // Create a clip path ID for the labels that covers the entire view
  const labelsClipId = getId(id, 'labels')

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
        {labelData.map(({ key, label, description, leftPos, topPos }) => (
          <g
            key={`label-${key}`}
            transform={`translate(${leftPos}, ${topPos})`}
          >
            <text x={0} y={11} fontSize={11} fill="currentColor">
              {label}
            </text>
            {description ? (
              <text x={0} y={25} fontSize={11} fill="blue">
                {description}
              </text>
            ) : null}
          </g>
        ))}
      </g>
    </>
  )
}
