import { awaitSvgReady } from '@jbrowse/core/svg/svgReady'
import { svgColorLegendWidth } from '@jbrowse/core/ui/SvgColorLegend'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import {
  getRowHeaderLayout,
  lgvSvgLayoutOptions,
} from '@jbrowse/plugin-linear-genome-view'

import { drawnConnectionKey } from '../components/drawnConnectionKey.ts'

import type { BreakpointViewModel } from '../model.ts'
import type { ExportSvgOptions } from '../types.ts'
import type { PageLayoutSubject } from '@jbrowse/plugin-linear-genome-view'
import type { ThemeOptions } from '@mui/material'

// display-kit's legend gutter inset, which places each track's key
export const CONNECTION_KEY_INSET = 10

/**
 * The overlay tracks an export draws: those some row renders, so a track
 * minimized in one row still links the rows that show it.
 */
export function exportedOverlayTrackIds(model: BreakpointViewModel) {
  return model.overlayTracks
    .map(track => track.configuration.trackId)
    .filter(id =>
      model.views.some(view =>
        view.tracks.some(t => {
          const display = t.displays[0]
          return (
            t.configuration.trackId === id &&
            !t.minimized &&
            display !== undefined &&
            'renderSvg' in display
          )
        }),
      ),
    )
}

/**
 * The export's connection key: its rows, the height it may take (the first
 * row's header band and ruler, above where any track's own key starts) and
 * the legend gutter it needs, 0 with no rows.
 */
export function exportedConnectionKey(
  model: BreakpointViewModel,
  theme: ThemeOptions | undefined,
  opts: ExportSvgOptions,
) {
  const { fontSize, rulerHeight } = lgvSvgLayoutOptions(opts)
  const maxHeight =
    getRowHeaderLayout({ fontSize, showScalebar: true }).bandHeight +
    rulerHeight
  const rows = drawnConnectionKey(
    model,
    resolvePalette({ configTheme: theme }),
    exportedOverlayTrackIds(model),
  )
  const width = svgColorLegendWidth(rows, maxHeight, opts.fontFamily)
  return {
    rows,
    maxHeight,
    gutterWidth: width > 0 ? width + CONNECTION_KEY_INSET : 0,
  }
}

/**
 * A breakpoint split view export on a page: its rows share the plot width,
 * and the connection key sits in the legend gutter beside the first row,
 * listing calls once the overlay fetch has committed.
 */
export function breakpointPageSubject(
  model: BreakpointViewModel,
  opts: ExportSvgOptions,
): PageLayoutSubject {
  return {
    node: model,
    views: model.views,
    legendWidth: (theme, fontFamily) =>
      exportedConnectionKey(model, theme, { ...opts, fontFamily }).gutterWidth,
    settled: () =>
      awaitSvgReady({
        get svgReady() {
          return model.overlaySvgReady
        },
        get error() {
          return model.overlayError
        },
      }),
  }
}
