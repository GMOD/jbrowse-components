import { awaitViewInitialized } from '@jbrowse/core/svg/svgReady'
import { notifySkippedSvgTracks } from '@jbrowse/core/svg/trackNames'
import { getSession } from '@jbrowse/core/util'

import { CytobandOverview } from './SVGHeader.tsx'
import SVGHighlightsOverlay from './SVGHighlightsOverlay.tsx'
import { lgvSvgDocument, lgvSvgLayoutOptions } from './lgvSvgDocument.tsx'
import { renderViewTracks } from './renderViewTracks.ts'
import { sessionTrackRows } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ExportSvgOptions } from '../types.ts'

type LGV = LinearGenomeViewModel

export async function renderToSvg(model: LGV, opts: ExportSvgOptions) {
  await awaitViewInitialized(model)
  // `initialized` only answers "have the assemblies loaded" — navigating is the
  // second async step, so an initialized view can still hold no regions: one
  // sitting on its import form, or one a `clearView` emptied. There is no
  // ruler, no scalebar and no track content to draw there, and the export used
  // to save the header's reserved height as a blank themed rectangle. Say why
  // instead, which the dialog shows as an error banner and a headless caller
  // (jbrowse-img) gets as a nonzero exit rather than a blank image. Same guard,
  // and the same reason, as the circular view's import-form export.
  if (!model.hasDisplayedRegions) {
    throw new Error('Cannot export: no regions are displayed')
  }
  const { fontSize, textHeight, trackLabels } = lgvSvgLayoutOptions(opts)
  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(opts.themeName)

  // owns the ordering this used to spell out by hand: the stack's height and
  // legend gutter measured after the awaits. Every display's `renderSvg` owns its
  // own readiness wait — an LGV display through `renderDisplaySvg`'s
  // `awaitSvgReady`, a non-LGV one (dotplot, synteny, circular) by calling that
  // itself.
  const { displayResults, tracksHeight, legendWidth, skippedTracks } =
    await renderViewTracks({
      view: model,
      opts: { ...opts, fontSize },
      theme,
      textHeight,
      trackLabels,
    })
  if (opts.announceSkipped !== false) {
    notifySkippedSvgTracks(session, skippedTracks)
  }

  // read after the displays' waits, so the reserved `tracksTop` and the drawn
  // header are one layout
  return lgvSvgDocument({
    view: model,
    rows: sessionTrackRows(displayResults, session),
    tracksHeight,
    legendWidth,
    theme,
    opts,
    cytobands: model.effectiveShowCytobands
      ? y => <CytobandOverview model={model} y={y} />
      : undefined,
    highlights: gaps => (
      <SVGHighlightsOverlay
        model={model}
        tracksHeight={tracksHeight}
        gaps={gaps}
      />
    ),
  })
}
