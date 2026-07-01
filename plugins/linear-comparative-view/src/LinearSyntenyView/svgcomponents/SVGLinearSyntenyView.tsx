import React from 'react'

import { exportMargin } from '@jbrowse/core/svg/constants'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getSession, max, measureText } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { totalHeight } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import SVGLinearGenomeView from './SVGLinearGenomeView.tsx'
import SVGSyntenyLevel from './SVGSyntenyLevel.tsx'
import { renderSvg as renderSyntenyDisplaySvg } from '../../LinearSyntenyDisplay/renderSvg.tsx'

import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model.ts'
import type { LinearSyntenyViewModel } from '../model.ts'
import type { ExportSvgOptions } from '../types.ts'

interface TrackEntry {
  displays: LinearSyntenyDisplayModel[]
}

// render LGV to SVG
export async function renderToSvg(
  model: LinearSyntenyViewModel,
  opts: ExportSvgOptions,
) {
  await when(() => model.initialized)
  const {
    textHeight = 18,
    rulerHeight = 30,
    fontSize = 13,
    trackLabels = 'offset',
    showGridlines = false,
    Wrapper = ({ children }) => children,
    themeName = 'default',
  } = opts
  const session = getSession(model)
  const themeVar = session.getActiveThemeOptions?.(themeName)
  const { width, views, levels } = model

  // each view is a header (assembly label + ruler) stacked above its tracks
  const headerHeight = fontSize + rulerHeight
  const tracksHeights = views.map(v =>
    totalHeight(v.tracks, textHeight, trackLabels),
  )
  const viewHeights = tracksHeights.map(h => headerHeight + h)

  // each display's renderSvg owns its own readiness wait (LGV track displays
  // await feature-density stats internally, renderSyntenyDisplaySvg awaits
  // featureData/error), so no outer when() gate is needed here
  const displayResults = await Promise.all(
    views.map(
      async view =>
        ({
          view,
          data: await Promise.all(
            view.tracks.map(async track => {
              const d = track.displays[0]
              return {
                track,
                result: await d.renderSvg({ ...opts, theme: themeVar }),
              }
            }),
          ),
        }) as const,
    ),
  )

  const renderings = await Promise.all(
    levels.map(level =>
      Promise.all(
        level.tracks.map((track: TrackEntry) =>
          renderSyntenyDisplaySvg(track.displays[0]!, opts),
        ),
      ),
    ),
  )

  const trackLabelMaxLen =
    max(
      views.flatMap(view =>
        view.tracks.map(track =>
          measureText(getTrackName(track.configuration, session), fontSize),
        ),
      ),
      0,
    ) + 40
  const trackLabelOffset = trackLabels === 'left' ? trackLabelMaxLen : 0
  const w = width + trackLabelOffset

  // walk top to bottom, alternating a genome view and the ribbon level beneath
  // it, advancing y by each element's own height so everything abuts with no
  // gaps. the ribbons for level i fill the band between view i and view i+1.
  const RenderList: React.ReactNode[] = []
  let y = 0
  for (let i = 0; i < views.length; i++) {
    RenderList.push(
      <g key={views[i]!.id} transform={`translate(0 ${y})`}>
        <SVGLinearGenomeView
          rulerHeight={rulerHeight}
          trackLabelOffset={trackLabelOffset}
          textHeight={textHeight}
          trackLabels={trackLabels}
          displayResults={displayResults[i]!}
          fontSize={fontSize}
          showGridlines={showGridlines}
          tracksHeight={tracksHeights[i]!}
        />
      </g>,
    )
    y += viewHeights[i]!
    const levelHeight = levels[i]?.height
    if (levelHeight !== undefined) {
      RenderList.push(
        <g key={`level-${i}`} transform={`translate(0 ${y})`}>
          <SVGSyntenyLevel
            clipId={`synclip-${model.id}-${i}`}
            width={width}
            levelHeight={levelHeight}
            trackLabelOffset={trackLabelOffset}
            rendering={renderings[i] ?? []}
          />
        </g>,
      )
      y += levelHeight
    }
  }
  const totalHeightSvg = y + exportMargin

  // the xlink namespace is used for rendering <image> tag
  return wrapSvgExport({
    theme: themeVar,
    width: w,
    height: totalHeightSvg,
    Wrapper,
    children: RenderList,
  })
}
