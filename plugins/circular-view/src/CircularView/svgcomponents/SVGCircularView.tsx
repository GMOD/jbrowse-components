import { Fragment } from 'react'

import { exportFontFamily } from '@jbrowse/core/svg/constants'
import {
  awaitSvgRenders,
  awaitViewInitialized,
} from '@jbrowse/core/svg/svgReady'
import { notifySkippedSvgTracks } from '@jbrowse/core/svg/trackNames'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import SvgColorLegend, {
  svgColorLegendWidth,
} from '@jbrowse/core/ui/SvgColorLegend'
import { legendEntries } from '@jbrowse/core/ui/legendSpec'
import { resolveStyleTheme } from '@jbrowse/core/ui/styleTheme'
import { getSession, radToDeg } from '@jbrowse/core/util'

import { RingAxes } from '../../rings/RingAxes.tsx'
import { RingOverlay } from '../../rings/RingOverlay.tsx'
import {
  RING_TOO_LARGE_REASON,
  canRasterizeRings,
  paintRingsSvg,
  renderRingBodies,
  undrawnRingTracks,
} from '../../rings/ringSvg.tsx'
import { Rulers } from '../components/Ruler.tsx'
import { figureGutterPx } from '../rulerLabels.ts'

import type { CircularViewModel, ExportSvgOptions } from '../model.ts'
import type { DisplayModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { ThemeOptions } from '@mui/material'
import type { ReactNode } from 'react'

const KEY_GAP_PX = 10

function keyEntries(
  model: CircularViewModel,
  palette: JBrowsePalette,
  undrawnIds: readonly string[],
) {
  return model.showLegend
    ? legendEntries(model.legendSpecIn(palette, undrawnIds))
    : []
}

/**
 * Px the export widens its square figure by for the key beside it: 0 with no
 * key, so a figure without one has no empty strip.
 */
export function circularKeyGutterPx(
  model: CircularViewModel,
  theme: ThemeOptions | undefined,
  undrawnIds: readonly string[],
  figureSize: number,
  fontFamily: string | undefined,
) {
  const { palette } = resolveStyleTheme({ configTheme: theme })
  const width = svgColorLegendWidth(
    keyEntries(model, palette, undrawnIds),
    figureSize,
    fontFamily,
  )
  return width > 0 ? width + KEY_GAP_PX : 0
}

/** The key, in the gutter right of the `figureSize` square circle. */
export function SvgCircularLegend({
  model,
  figureSize,
  undrawnIds = [],
}: {
  model: CircularViewModel
  figureSize: number
  undrawnIds?: readonly string[]
}) {
  const palette = usePalette()
  return (
    <SvgColorLegend
      entries={keyEntries(model, palette, undrawnIds)}
      canvasWidth={figureSize}
      x={figureSize + KEY_GAP_PX}
      maxHeight={figureSize}
      testid="color-legend"
      idPrefix={`legend-${model.id}`}
    />
  )
}

type Track = CircularViewModel['tracks'][number]

// a chord display and a ring's linear display each may draw itself to SVG
type SvgDisplay = DisplayModel & {
  renderSvg?: (opts: ExportSvgDisplayOptions) => Promise<ReactNode>
}

function drawsSvg(
  display: SvgDisplay | undefined,
): display is SvgDisplay & Required<Pick<SvgDisplay, 'renderSvg'>> {
  return !!display?.renderSvg
}

function svgDisplayOf(track: Track) {
  const display: SvgDisplay | undefined = track.displays[0]
  return drawsSvg(display) ? display : undefined
}

export async function renderToSvg(
  model: CircularViewModel,
  opts: ExportSvgOptions,
) {
  await awaitViewInitialized(model)
  if (!model.displayedRegions.length) {
    throw new Error('Cannot export: no regions are displayed')
  }
  const { themeName, fontFamily, Wrapper } = opts
  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)

  // a display with no renderSvg is skipped and named; a ring's export is
  // warped by paintRingsSvg instead
  const { ringHost } = model
  const isRing = (t: Track) => {
    const display = t.displays[0]
    return !!display && model.isRingDisplay(display)
  }
  const exportable = model.tracks.flatMap(t => {
    const display = svgDisplayOf(t)
    return display && !isRing(t) ? [{ id: t.id, display }] : []
  })
  const ringsDrawable = canRasterizeRings(opts)
  if (opts.announceSkipped !== false) {
    notifySkippedSvgTracks(
      session,
      model.tracks.filter(t => !svgDisplayOf(t)),
    )
    if (!ringsDrawable) {
      notifySkippedSvgTracks(
        session,
        model.tracks.filter(t => svgDisplayOf(t) && isRing(t)),
        'Ring tracks are rasterized, and this environment cannot decode an image.',
      )
    }
  }

  // a track whose data won't load fails the export, named
  const [displayResults, ringBodies] = await awaitSvgRenders([
    awaitSvgRenders(
      exportable.map(async ({ id, display }) => ({
        id,
        result: await display.renderSvg({ ...opts, theme }),
      })),
    ),
    ringsDrawable ? renderRingBodies(model.ringDisplays, opts, theme) : [],
  ])

  const ringRows = undrawnRingTracks(model.tracks.filter(isRing), ringBodies)
  if (ringsDrawable && opts.announceSkipped !== false) {
    notifySkippedSvgTracks(session, ringRows.tooLarge, RING_TOO_LARGE_REASON)
  }
  const undrawnIds = [
    ...model.tracks.filter(t => !svgDisplayOf(t)),
    ...ringRows.undrawn,
  ].flatMap(t => t.displays.map(d => d.id))

  // read after the waits, since a zoom or rotation may land during them
  const {
    radiusPx,
    offsetRadians,
    staticSlices,
    effectivePaddingPx: paddingPx,
  } = model

  // the export grows to its labels where the screen clips them
  const gutterPx = Math.max(
    paddingPx,
    figureGutterPx(model, exportFontFamily(fontFamily)),
  )
  const figureSize = 2 * (radiusPx + gutterPx)
  const center = radiusPx + gutterPx
  const rings = await paintRingsSvg(ringHost, ringBodies, opts, theme, {
    size: figureSize,
    center,
    offsetRadians,
  })

  return wrapSvgExport({
    theme,
    width:
      figureSize +
      circularKeyGutterPx(model, theme, undrawnIds, figureSize, fontFamily),
    height: figureSize,
    margin: 0,
    fontFamily,
    Wrapper,
    children: (
      <>
        {rings}
        <g
          transform={`translate(${center},${center}) rotate(${radToDeg(offsetRadians)})`}
        >
          <Rulers model={model} />
          <RingAxes
            model={{
              ringHost: {
                rings: ringHost.rings.filter(
                  r => !undrawnIds.includes(r.display.id),
                ),
              },
              offsetRadians,
              staticSlices,
            }}
          />
          <RingOverlay model={model} exporting />
          {displayResults.map(({ id, result }) => (
            <Fragment key={id}>{result}</Fragment>
          ))}
        </g>
        <SvgCircularLegend
          model={model}
          figureSize={figureSize}
          undrawnIds={undrawnIds}
        />
      </>
    ),
  })
}
