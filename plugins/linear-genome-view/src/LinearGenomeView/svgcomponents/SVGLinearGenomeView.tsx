/* eslint-disable react-refresh/only-export-components */

import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  getSession,
  max,
  measureText,
  renderToStaticMarkup,
} from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { ThemeProvider } from '@mui/material'
import { when } from 'mobx'

import SVGBackground from './SVGBackground'
import SVGHeader from './SVGHeader'
import SVGTracks from './SVGTracks'
import { totalHeight } from './util'

import type { LinearGenomeViewModel } from '..'
import type { ExportSvgOptions } from '../types'

type LGV = LinearGenomeViewModel

// Layout constants
const HORIZONTAL_PADDING = 50
const TRACK_LABEL_PADDING = 40
const HEADER_SPACING = 10
const BOTTOM_PADDING = 100

interface LayoutDimensions {
  totalWidth: number
  totalHeight: number
  headerOffset: number
  trackLabelOffset: number
}

/**
 * Renders all track displays and waits for them to be ready
 */
async function renderTrackDisplays(
  model: LGV,
  opts: ExportSvgOptions,
  theme: any,
) {
  const { pinnedTracks, unpinnedTracks } = model
  const allTracks = [...pinnedTracks, ...unpinnedTracks]

  return await Promise.all(
    allTracks.map(async track => {
      const display = track.displays[0]
      await when(() => !display.renderProps().notReady)
      return {
        track,
        result: await display.renderSvg({ ...opts, theme }),
      }
    }),
  )
}

/**
 * Calculates the maximum width needed for track labels
 */
function calculateTrackLabelWidth(model: LGV, fontSize: number): number {
  const session = getSession(model)
  const { tracks } = model

  const maxLabelWidth = max(
    tracks.map(track =>
      measureText(getTrackName(track.configuration, session), fontSize),
    ),
    0,
  )

  return maxLabelWidth + TRACK_LABEL_PADDING
}

/**
 * Calculates all layout dimensions for the SVG
 */
function calculateLayoutDimensions(
  model: LGV,
  opts: ExportSvgOptions,
): LayoutDimensions {
  const {
    textHeight = 18,
    headerHeight = 40,
    rulerHeight = 50,
    fontSize = 13,
    cytobandHeight = 100,
    trackLabels = 'offset',
  } = opts

  const { width, tracks, showCytobands } = model

  // Calculate cytoband height (converts boolean to 0 or 1)
  const cytobandDisplayHeight = +showCytobands * cytobandHeight

  // Calculate vertical offsets
  const headerOffset =
    headerHeight + rulerHeight + cytobandDisplayHeight + HEADER_SPACING

  // Calculate total height including tracks and padding
  const tracksHeight = totalHeight(tracks, textHeight, trackLabels)
  const svgHeight = tracksHeight + headerOffset + BOTTOM_PADDING

  // Calculate horizontal dimensions
  const trackLabelMaxWidth = calculateTrackLabelWidth(model, fontSize)
  const trackLabelOffset = trackLabels === 'left' ? trackLabelMaxWidth : 0
  const svgWidth = width + trackLabelOffset

  return {
    totalWidth: svgWidth,
    totalHeight: svgHeight,
    headerOffset,
    trackLabelOffset,
  }
}

/**
 * Renders the Linear Genome View to SVG format
 */
export async function renderToSvg(model: LGV, opts: ExportSvgOptions) {
  // Wait for the model to be fully initialized
  await when(() => model.initialized)

  // Extract options with defaults
  const {
    textHeight = 18,
    fontSize = 13,
    rulerHeight = 50,
    cytobandHeight = 100,
    trackLabels = 'offset',
    themeName = 'default',
    Wrapper = ({ children }) => children,
  } = opts

  // Get theme
  const session = getSession(model)
  const theme = session.allThemes?.()[themeName]

  // Calculate layout dimensions
  const dimensions = calculateLayoutDimensions(model, opts)

  // Render all track displays
  const displayResults = await renderTrackDisplays(model, opts, theme)

  // Calculate viewBox with horizontal padding on both sides
  const viewBoxWidth = dimensions.totalWidth + HORIZONTAL_PADDING * 2

  // Render the SVG (xlink namespace is used for <image> tags)
  return renderToStaticMarkup(
    <ThemeProvider theme={createJBrowseTheme(theme)}>
      <Wrapper>
        <svg
          width={dimensions.totalWidth}
          height={dimensions.totalHeight}
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox={[0, 0, viewBoxWidth, dimensions.totalHeight].toString()}
        >
          <SVGBackground
            width={dimensions.totalWidth}
            height={dimensions.totalHeight}
            shift={HORIZONTAL_PADDING}
          />
          <g transform={`translate(${HORIZONTAL_PADDING} 0)`}>
            <g transform={`translate(${dimensions.trackLabelOffset})`}>
              <SVGHeader
                model={model}
                fontSize={fontSize}
                rulerHeight={rulerHeight}
                cytobandHeight={cytobandHeight}
              />
            </g>
            <g transform={`translate(0 ${dimensions.headerOffset})`}>
              <SVGTracks
                textHeight={textHeight}
                fontSize={fontSize}
                model={model}
                displayResults={displayResults}
                trackLabels={trackLabels}
                trackLabelOffset={dimensions.trackLabelOffset}
              />
            </g>
          </g>
        </svg>
      </Wrapper>
    </ThemeProvider>,
  )
}

export { default as SVGRuler } from './SVGRuler'
export { default as SVGTracks } from './SVGTracks'
