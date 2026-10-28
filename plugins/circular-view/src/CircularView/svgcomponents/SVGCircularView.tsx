import { Fragment } from 'react'

import {
  awaitSvgRenders,
  awaitViewInitialized,
} from '@jbrowse/core/svg/svgReady'
import { notifySkippedSvgTracks } from '@jbrowse/core/svg/trackNames'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import SvgColorLegend from '@jbrowse/core/ui/SvgColorLegend'
import { legendEntries } from '@jbrowse/core/ui/legendSpec'
import { getSession, radToDeg } from '@jbrowse/core/util'

import { RingAxes } from '../../rings/RingAxes.tsx'
import { RingOverlay } from '../../rings/RingOverlay.tsx'
import {
  canRasterizeRings,
  paintRingsSvg,
  renderRingBodies,
} from '../../rings/ringSvg.tsx'
import { Rulers } from '../components/Ruler.tsx'
import { figureGutterPx } from '../rulerLabels.ts'

import type { CircularViewModel, ExportSvgOptions } from '../model.ts'
import type { DisplayModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { ReactNode } from 'react'

export function SvgCircularLegend({
  model,
  size,
}: {
  model: CircularViewModel
  size: number
}) {
  const palette = usePalette()
  return (
    <SvgColorLegend
      entries={legendEntries(model.legendSpecIn(palette))}
      canvasWidth={size}
      maxHeight={size}
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
  const { ringDisplays } = ringHost
  const isRing = (t: Track) =>
    ringDisplays.some(ring => ring.id === t.displays[0]?.id)
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
    ringsDrawable ? renderRingBodies(ringHost, opts, theme) : [],
  ])

  // read after the waits, since a zoom or rotation may land during them
  const { radiusPx, offsetRadians, effectivePaddingPx: paddingPx } = model

  // the export grows to its labels where the screen clips them
  const gutterPx = Math.max(paddingPx, figureGutterPx(model))
  const figureSize = 2 * (radiusPx + gutterPx)
  const center = radiusPx + gutterPx
  const rings = await paintRingsSvg(ringHost, ringBodies, opts, theme, {
    size: figureSize,
    center,
    offsetRadians,
  })

  return wrapSvgExport({
    theme,
    width: figureSize,
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
          <RingAxes model={model} />
          <RingOverlay model={model} exporting />
          {displayResults.map(({ id, result }) => (
            <Fragment key={id}>{result}</Fragment>
          ))}
        </g>
        {model.showLegend ? (
          <SvgCircularLegend model={model} size={figureSize} />
        ) : null}
      </>
    ),
  })
}
