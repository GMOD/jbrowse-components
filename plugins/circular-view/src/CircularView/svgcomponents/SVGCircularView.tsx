import { Fragment } from 'react'

import { awaitViewInitialized } from '@jbrowse/core/svg/svgReady'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { getSession, radToDeg } from '@jbrowse/core/util'

import { Rulers } from '../components/Ruler.tsx'
import { labelGutterPx } from '../rulerLabels.ts'

import type { CircularViewModel, ExportSvgOptions } from '../model.ts'

export async function renderToSvg(
  model: CircularViewModel,
  opts: ExportSvgOptions,
) {
  await awaitViewInitialized(model)
  // an initialized view with no regions is one sitting on its import form:
  // there is no figure, only the padding, so an export would save a blank
  // square the size of the gutter. Say why instead — the dialog shows it as an
  // error banner
  if (!model.displayedRegions.length) {
    throw new Error('Cannot export: no regions are displayed')
  }
  const { themeName = 'default', fontFamily, Wrapper } = opts
  const session = getSession(model)
  const theme = session.getActiveThemeOptions?.(themeName)

  const displayResults = await Promise.all(
    model.tracks.map(async track => ({
      id: track.id,
      result: await track.displays[0]!.renderSvg({ ...opts, theme }),
    })),
  )

  // Deliberately read after that wait, not before. The figure's size and center
  // both follow bpPerPx, and its rotation is a live property; a zoom or a
  // rotation landing while a track's features are still in flight moves all
  // three. Everything below the wrapper — the rulers, the chords, the label
  // flipping that reads offsetRadians for itself — is drawn from the values as
  // of *this* point, so measuring up front sized and centered the canvas for
  // the pre-wait geometry and drew a figure that was off-center in it, or
  // clipped by it. (Same ordering rule as the dotplot and LGV exports.)
  const { radiusPx, offsetRadians, paddingPx } = model

  // The view's own `paddingPx` is a fixed guess at how much room the ruler
  // labels need, and on screen a label that overruns it is merely clipped by a
  // box the user can resize. An export is a standalone artifact, so it takes
  // whichever is larger: a 12-character RefSeq accession already overruns the
  // default 80px and used to come out with its last characters cut off at the
  // canvas edge.
  const gutterPx = Math.max(paddingPx, labelGutterPx(model))
  const figureSize = 2 * (radiusPx + gutterPx)
  const center = radiusPx + gutterPx

  return wrapSvgExport({
    theme,
    width: figureSize,
    height: figureSize,
    // the gutter above is the margin, and it has to be inside the figure's own
    // square rather than added around it, since the circle is centered in it
    margin: 0,
    fontFamily,
    Wrapper,
    children: (
      <g
        transform={`translate(${center},${center}) rotate(${radToDeg(offsetRadians)})`}
      >
        <Rulers model={model} />
        {displayResults.map(({ id, result }) => (
          <Fragment key={id}>{result}</Fragment>
        ))}
      </g>
    ),
  })
}
