import React from 'react'

import { SVGExportRoot } from '@jbrowse/core/svg/SvgExport'
import { exportMargin } from '@jbrowse/core/svg/constants'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  getSession,
  max,
  measureText,
  renderToStaticMarkup,
} from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { totalHeight } from '@jbrowse/plugin-linear-genome-view'
import { ThemeProvider } from '@mui/material'
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
  const themeVar = session.allThemes?.()[themeName]
  const { width, views, levels } = model

  // each view is a header (assembly label + ruler) stacked above its tracks
  const headerHeight = fontSize + rulerHeight
  const tracksHeights = views.map(v =>
    totalHeight(v.tracks, textHeight, trackLabels),
  )
  const viewHeights = tracksHeights.map(h => headerHeight + h)

  const displayResults = await Promise.all(
    views.map(
      async view =>
        ({
          view,
          data: await Promise.all(
            view.tracks.map(async track => {
              const d = track.displays[0]
              await when(() => d.ready ?? true)
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
    levels.map(async level => {
      const { tracks } = level
      return Promise.all(
        tracks.map(async (track: TrackEntry) => {
          const d = track.displays[0]!
          await when(() => !d.loading)
          return renderSyntenyDisplaySvg(d, opts)
        }),
      )
    }),
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
  const theme = createJBrowseTheme(themeVar)

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
  return renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <Wrapper>
        <SVGExportRoot width={w} height={totalHeightSvg}>
          {RenderList}
        </SVGExportRoot>
      </Wrapper>
    </ThemeProvider>,
  )
}
