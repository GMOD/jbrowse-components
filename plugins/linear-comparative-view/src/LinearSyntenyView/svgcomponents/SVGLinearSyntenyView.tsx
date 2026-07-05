import type { ReactNode } from 'react'

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

  // each display's renderSvg owns its own readiness wait (LGV track displays
  // await feature-density stats internally, renderSyntenyDisplaySvg awaits
  // featureData/error), so no outer when() gate is needed here. The genome-view
  // track results and the ribbon levels are independent, so let both fan out
  // concurrently rather than blocking one behind the other.
  const [displayResults, renderings] = await Promise.all([
    Promise.all(
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
    ),
    Promise.all(
      levels.map(level =>
        Promise.all(
          // linearSyntenyDisplays' getter return type widens to any through the
          // view's Instance type (MST drops getter types), so annotate d.
          level.linearSyntenyDisplays.map((d: LinearSyntenyDisplayModel) =>
            renderSyntenyDisplaySvg(d, opts),
          ),
        ),
      ),
    ),
  ])

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

  // The export is a vertical stack, top to bottom: each genome view, and
  // directly beneath it the synteny ribbon level between it and the next view.
  // The last view has no level below it (N views -> N-1 levels), so `levels[i]`
  // is the single source of that invariant — no index bookkeeping in the layout.
  const rows = views.flatMap((view, i) => {
    const viewRow = {
      key: view.id,
      height: headerHeight + tracksHeights[i]!,
      node: (
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
      ),
    }
    const level = levels[i]
    return level
      ? [
          viewRow,
          {
            key: `level-${i}`,
            height: level.height,
            node: (
              <SVGSyntenyLevel
                clipId={`synclip-${model.id}-${i}`}
                width={width}
                levelHeight={level.height}
                trackLabelOffset={trackLabelOffset}
                rendering={renderings[i]!}
              />
            ),
          },
        ]
      : [viewRow]
  })

  // stack the rows top to bottom: one fold threads `y` (the running top offset)
  // through them, producing both the positioned groups and the final height in a
  // single pass — so the canvas size and the layout share one source of truth.
  const stacked = rows.reduce<{ y: number; children: ReactNode[] }>(
    (acc, row) => ({
      y: acc.y + row.height,
      children: [
        ...acc.children,
        <g key={row.key} transform={`translate(0 ${acc.y})`}>
          {row.node}
        </g>,
      ],
    }),
    { y: 0, children: [] },
  )

  // the xlink namespace is used for rendering <image> tag
  return wrapSvgExport({
    theme: themeVar,
    width: w,
    height: stacked.y + exportMargin,
    Wrapper,
    children: stacked.children,
  })
}
