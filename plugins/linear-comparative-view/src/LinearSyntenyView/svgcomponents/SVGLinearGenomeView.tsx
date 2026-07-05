import type { ReactNode } from 'react'

import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { exportMargin } from '@jbrowse/core/svg/constants'
import { getEnv } from '@jbrowse/core/util'
import {
  SVGHighlights,
  SVGView,
} from '@jbrowse/plugin-linear-genome-view'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  LinearGenomeViewModel,
  TrackLabelMode,
} from '@jbrowse/plugin-linear-genome-view'

export interface ViewDisplayResults {
  view: LinearGenomeViewModel
  data: {
    track: {
      configuration: AnyConfigurationModel
      displays: { height: number }[]
    }
    result: ReactNode
  }[]
}

export default function SVGLinearGenomeView({
  trackLabelOffset,
  fontSize,
  textHeight,
  trackLabels,
  displayResults,
  rulerHeight,
  showGridlines = false,
  tracksHeight,
}: {
  textHeight: number
  trackLabels: TrackLabelMode
  trackLabelOffset: number
  fontSize: number
  displayResults: ViewDisplayResults
  rulerHeight: number
  showGridlines?: boolean
  tracksHeight: number
}) {
  const { view } = displayResults
  const { pluginManager } = getEnv(view)
  const clipId = `highlight-clip-${view.id}`
  const bookmarkHighlights = pluginManager.evaluateExtensionPoint(
    /** #extensionPoint LinearGenomeView-HighlightSVGComponent | sync | Add an SVG highlight overlay in the LGV SVG export */
    'LinearGenomeView-HighlightSVGComponent',
    [] as ReactNode[],
    { model: view, height: tracksHeight },
  )
  return (
    <g transform={`translate(${exportMargin} ${fontSize})`}>
      <SVGView
        view={view}
        displayResults={displayResults.data}
        fontSize={fontSize}
        textHeight={textHeight}
        trackLabels={trackLabels}
        trackLabelOffset={trackLabelOffset}
        contentTop={rulerHeight}
        tracksHeight={tracksHeight}
        showGridlines={showGridlines}
      />
      <g transform={`translate(${trackLabelOffset} ${rulerHeight})`}>
        <SvgClipRect id={clipId} width={view.width} height={tracksHeight}>
          <SVGHighlights model={view} height={tracksHeight} />
          {bookmarkHighlights}
        </SvgClipRect>
      </g>
    </g>
  )
}
