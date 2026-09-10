/* eslint-disable react-refresh/only-export-components -- the shell and the key it appends are one module */
import { Fragment } from 'react'

import { SvgChrome } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { awaitSvgReady } from '@jbrowse/core/svg/svgReady'
import SvgColorLegend from '@jbrowse/core/ui/SvgColorLegend'
import { legendEntries } from '@jbrowse/core/ui/legendSpec'
import {
  AXIS_RIGHT_INSET_PX,
  AxisGutter,
  CrossHatchLines,
  SCORE_CAPTION_HEIGHT,
  ScoreDomainCaption,
  ScoreRuleLines,
  axisDrawn,
  axisGutterLeft,
} from '@jbrowse/display-ui'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'

import {
  axisCaptionsReservedPx,
  captionedAxes,
  isAxisHost,
} from './axisHost.ts'
import { containingHost } from './foundationView.ts'
import { isLegendHost } from './legendHost.ts'
import { svgLegendAreaReserved } from './types.ts'

import type { AxisHost } from './axisHost.ts'
import type { LegendHost } from './legendHost.ts'
import type { RegionHost } from './regionHost.ts'
import type { ExportSvgDisplayOptions } from './types.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type React from 'react'

/**
 * The minimum a display must expose to be exported through {@link
 * renderDisplaySvg}: the terminal-state trio from `SvgExportable` plus the
 * height its box occupies.
 */
export interface LgvSvgExportable extends SvgExportable, IStateTreeNode {
  height: number
  /**
   * Whether the display paints its own body in the too-large terminal instead
   * of `SvgChrome`'s note. Optional, and absent means it does not: only a
   * display that draws something in the place of the features the gate refused
   * — canvas's density band — answers `true`, and for it the note would be the
   * one thing on screen the export left out.
   */
  drawsWhenTooLarge?: boolean
}

/**
 * What the shell resolves for the body. `canvasWidth` is the load-bearing one:
 * see {@link renderDisplaySvg}.
 */
export interface LgvSvgBodyProps<M> {
  model: M
  view: RegionHost
  height: number
  /**
   * The width the export paints at — `view.width`, deliberately NOT the
   * `view.trackWidthPx` a display's on-screen `renderState` carries.
   * `trackWidthPx` subtracts the 2px track outline, which the export doesn't
   * draw, and it is also the block scissor bound handed to `forEachClippedBlock`
   * — so painting an export at it clips the rightmost 2px column of content
   * inside a `view.width`-wide frame. `LinearMultiRowFeatureDisplay` shipped
   * exactly that bug. A body that reuses `model.renderState` must override
   * `canvasWidth` with this value.
   */
  canvasWidth: number
  /**
   * The view's visible regions as render blocks. Resolved here because every
   * body wanted the identical `buildRenderBlocks(view.visibleRegions)` and each
   * wrote its own — the same reason `canvasWidth` is resolved here rather than
   * re-derived per display.
   */
  renderBlocks: RenderBlock[]
  opts: ExportSvgDisplayOptions | undefined
}

// Gap between the plot's right edge and a legend parked in the export's
// reserved gutter.
const GUTTER_INSET = 10

/**
 * The exported key of a display composing `LegendMixin`, drawn by the shell
 * off the same `legendSpec` the chrome draws on screen. Over the plot's
 * top-right corner, as every display placed its own; beside the plot when the
 * display reserved the export gutter (`svgLegendWidth`) and the container
 * granted it. No `onDismiss`: an exported legend cannot be clicked. Exported
 * so a display's test can render its key without a fetch.
 */
export function SvgLegend({
  model,
  width,
  height,
  opts,
}: {
  model: LegendHost
  width: number
  height: number
  opts: ExportSvgDisplayOptions | undefined
}) {
  const gutter =
    svgLegendAreaReserved(opts) && (model.svgLegendWidth?.() ?? 0) > 0
  const top =
    (model.legendTop ?? 0) +
    (isAxisHost(model) ? axisCaptionsReservedPx(model) : 0)
  if (!model.showLegend) {
    return null
  }
  const key = (
    <SvgColorLegend
      entries={legendEntries(model.legendSpec)}
      canvasWidth={width}
      x={gutter ? width + GUTTER_INSET : undefined}
      maxHeight={height - top}
      testid="color-legend"
      idPrefix={`legend-${svgNodeId(model)}`}
    />
  )
  return top > 0 ? <g transform={`translate(0 ${top})`}>{key}</g> : key
}

/**
 * The exported y axes of a display declaring value scales, drawn by the shell
 * off the same ticks the chrome draws on screen: for each scale, once per band
 * it rules, the cross-hatch guide lines across the band when the display
 * shows them, the reader's rules over those, and the axis in its gutter. A
 * left-side axis nothing pushes right sits in the export margin with its
 * spine on the content edge, so the numbers land outside the plot. A scale
 * whose bands are too short for an axis is captioned `[min, max]` once at
 * the top-right, as on screen. Tick y-positions carry the plot box's inset,
 * so a band's `top` is the only translate.
 */
export function SvgYAxis({
  model,
  view,
  width,
}: {
  model: AxisHost
  view: { offsetPx: number }
  width: number
}) {
  const { axes, height, showCrossHatches } = model
  const rules = model.scoreRuleMarks ?? []
  const contentLeft = Math.max(-view.offsetPx, 0)
  return (
    <>
      {axes.map((axis, i) => {
        const fits = axisDrawn(axis)
        const gutterLeft = axisGutterLeft(
          axis,
          width,
          AXIS_RIGHT_INSET_PX,
          contentLeft,
        )
        return (axis.bandTops ?? [0])
          .filter(top => top + axis.height >= 0 && top <= height)
          .map(top => (
            // eslint-disable-next-line @eslint-react/no-array-index-key -- the scales are declared in a fixed order
            <Fragment key={`${i}-${top}`}>
              {showCrossHatches && fits ? (
                <CrossHatchLines
                  ticks={axis.ticks}
                  width={width}
                  offsetY={top}
                />
              ) : null}
              {rules.length > 0 ? (
                <ScoreRuleLines marks={rules} width={width} offsetY={top} />
              ) : null}
              {fits ? (
                <g transform={`translate(${gutterLeft} ${top})`}>
                  <AxisGutter axis={axis} />
                </g>
              ) : null}
            </Fragment>
          ))
      })}
      {captionedAxes(model).map((axis, i) => (
        <g
          // eslint-disable-next-line @eslint-react/no-array-index-key -- stacked in declaration order
          key={i}
          transform={`translate(0 ${i * SCORE_CAPTION_HEIGHT})`}
        >
          <ScoreDomainCaption
            domain={axis.domain}
            scaleType={axis.scaleType}
            canvasWidth={width}
          />
        </g>
      ))}
    </>
  )
}

/**
 * The async shell every LGV display's `renderSvg` opens with: await readiness,
 * resolve the view geometry once, mount the single terminal-state gate around
 * the display's own body, and append the legend of a display that has one.
 *
 * A display that failed to load fails the whole export, in `awaitSvgReady`
 * itself. `regionTooLarge` is the other terminal and stays drawn: see
 * `SvgChrome` for why the two are not symmetric.
 *
 * `Body` is a **component**, not a callback, and that is load-bearing:
 * `SvgChrome` renders `SVGMessageBox` *instead of* its children in a terminal
 * state, so a body expressed as a component never runs there and no `renderSvg`
 * has to re-detect a terminal from empty or absent data. The contract is
 * documented in `agent-docs/reference/SVG_EXPORT.md`; this function is where it
 * is enforced rather than restated per display.
 *
 * ```tsx
 * export async function renderSvg(model: RenderSvgModel, opts?: ExportSvgDisplayOptions) {
 *   return renderDisplaySvg(model, opts, XxxSvgBody)
 * }
 *
 * function XxxSvgBody({ model, view, height, canvasWidth, opts }: LgvSvgBodyProps<RenderSvgModel>) {
 *   ...
 * }
 * ```
 */
export async function renderDisplaySvg<M extends LgvSvgExportable>(
  model: M,
  opts: ExportSvgDisplayOptions | undefined,
  Body: React.ComponentType<LgvSvgBodyProps<M>>,
): Promise<React.ReactNode> {
  await awaitSvgReady(model)
  const view = containingHost(model)
  const height = model.height
  return (
    <SvgChrome
      regionTooLarge={model.regionTooLarge && !model.drawsWhenTooLarge}
      width={view.width}
      height={height}
    >
      <Body
        model={model}
        view={view}
        height={height}
        canvasWidth={view.width}
        renderBlocks={buildRenderBlocks(view.visibleRegions)}
        opts={opts}
      />
      {isAxisHost(model) && !opts?.plotOnly ? (
        <SvgYAxis model={model} view={view} width={view.width} />
      ) : null}
      {isLegendHost(model) && !opts?.plotOnly ? (
        <SvgLegend
          model={model}
          width={view.width}
          height={height}
          opts={opts}
        />
      ) : null}
    </SvgChrome>
  )
}
