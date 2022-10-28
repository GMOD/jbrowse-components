import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { when } from 'mobx'
import { getParent } from 'mobx-state-tree'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { getSession, getBpDisplayStr } from '@jbrowse/core/util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import Base1DView from '@jbrowse/core/util/Base1DViewModel'

// locals
import Ruler from './Ruler'
import {
  LinearGenomeViewModel,
  ExportSvgOptions,
  HEADER_OVERVIEW_HEIGHT,
} from '..'
import { Polygon, Cytobands } from './OverviewScaleBar'

type LGV = LinearGenomeViewModel

function ScaleBar({ model, fontSize }: { model: LGV; fontSize: number }) {
  const {
    offsetPx,
    dynamicBlocks: { totalWidthPxWithoutBorders: totalWidthPx, totalBp },
  } = model
  const displayBp = getBpDisplayStr(totalBp)
  const x0 = Math.max(-offsetPx, 0)
  const x1 = x0 + totalWidthPx
  return (
    <>
      <line x1={x0} x2={x1} y1={10} y2={10} stroke="black" />
      <line x1={x0} x2={x0} y1={5} y2={15} stroke="black" />
      <line x1={x1} x2={x1} y1={5} y2={15} stroke="black" />
      <text
        x={x0 + (x1 - x0) / 2}
        y={fontSize * 2}
        textAnchor="middle"
        fontSize={fontSize}
      >
        {displayBp}
      </text>
    </>
  )
}

function SVGRuler({
  model,
  fontSize,
  width,
}: {
  model: LGV
  fontSize: number
  width: number
}) {
  const {
    dynamicBlocks: { contentBlocks },
    offsetPx: viewOffsetPx,
    bpPerPx,
  } = model
  const renderRuler = contentBlocks.length < 5
  return (
    <>
      <defs>
        <clipPath id="clip-ruler">
          <rect x={0} y={0} width={width} height={20} />
        </clipPath>
      </defs>
      {contentBlocks.map(block => {
        const { key, start, end, reversed, offsetPx, refName } = block
        const offsetLeft = offsetPx - viewOffsetPx
        return (
          <g key={`${key}`} transform={`translate(${offsetLeft} 0)`}>
            <text x={offsetLeft / bpPerPx} y={fontSize} fontSize={fontSize}>
              {refName}
            </text>
            {renderRuler ? (
              <g transform="translate(0 20)" clipPath="url(#clip-ruler)">
                <Ruler
                  start={start}
                  end={end}
                  bpPerPx={bpPerPx}
                  reversed={reversed}
                />
              </g>
            ) : (
              <line
                strokeWidth={1}
                stroke="black"
                x1={start / bpPerPx}
                x2={end / bpPerPx}
                y1={20}
                y2={20}
              />
            )}
          </g>
        )
      })}
    </>
  )
}

const fontSize = 15
const rulerHeight = 50
const textHeight = fontSize + 5
const paddingHeight = 20
const headerHeight = textHeight + 20
const cytobandHeightIfExists = 100

interface Display {
  height: number
}
interface Track {
  displays: Display[]
}

const totalHeight = (tracks: Track[]) => {
  return tracks.reduce((accum, track) => {
    const display = track.displays[0]
    return accum + display.height + paddingHeight + textHeight
  }, 0)
}

// SVG component, ruler and assembly name
const SVGHeader = ({ model }: { model: LGV }) => {
  const { width, assemblyNames, showCytobands, displayedRegions } = model
  const { assemblyManager } = getSession(model)
  const assemblyName = assemblyNames.length > 1 ? '' : assemblyNames[0]
  const assembly = assemblyManager.get(assemblyName)

  const overview = Base1DView.create({
    displayedRegions: JSON.parse(JSON.stringify(displayedRegions)),
    interRegionPaddingWidth: 0,
    minimumBlockWidth: model.minimumBlockWidth,
  })
  const visibleRegions = model.dynamicBlocks.contentBlocks

  overview.setVolatileWidth(width)
  overview.showAllRegions()
  const block = overview.dynamicBlocks.contentBlocks[0]

  const first = visibleRegions[0]
  const firstOverviewPx =
    overview.bpToPx({
      ...first,
      coord: first.reversed ? first.end : first.start,
    }) || 0

  const last = visibleRegions[visibleRegions.length - 1]
  const lastOverviewPx =
    overview.bpToPx({
      ...last,
      coord: last.reversed ? last.start : last.end,
    }) || 0

  const cytobandHeight = showCytobands ? cytobandHeightIfExists : 0

  return (
    <g id="header">
      <text x={0} y={fontSize} fontSize={fontSize}>
        {assemblyName}
      </text>

      {showCytobands ? (
        <g transform={`translate(0 ${rulerHeight})`}>
          <Cytobands overview={overview} assembly={assembly} block={block} />
          <rect
            stroke="red"
            fill="rgb(255,0,0,0.1)"
            width={Math.max(lastOverviewPx - firstOverviewPx, 0.5)}
            height={HEADER_OVERVIEW_HEIGHT - 1}
            x={firstOverviewPx}
            y={0.5}
          />
          <g transform={`translate(0,${HEADER_OVERVIEW_HEIGHT})`}>
            <Polygon overview={overview} model={model} useOffset={false} />
          </g>
        </g>
      ) : null}

      <g transform={`translate(0 ${fontSize + cytobandHeight})`}>
        <ScaleBar model={model} fontSize={fontSize} />
      </g>
      <g transform={`translate(0 ${rulerHeight + cytobandHeight})`}>
        <SVGRuler model={model} fontSize={fontSize} width={width} />
      </g>
    </g>
  )
}

// SVG component, region separator
const SVGRegionSeparators = ({
  model,
  height,
}: {
  height: number
  model: LGV
}) => {
  const { dynamicBlocks, offsetPx, interRegionPaddingWidth } = model
  return (
    <>
      {dynamicBlocks.contentBlocks.slice(1).map(block => (
        <rect
          key={block.key}
          x={block.offsetPx - offsetPx - interRegionPaddingWidth}
          width={interRegionPaddingWidth}
          y={0}
          height={height}
          stroke="none"
          fill="grey"
        />
      ))}
    </>
  )
}

// SVG component, tracks
function SVGTracks({
  displayResults,
  model,
  offset,
}: {
  displayResults: {
    track: {
      configuration: AnyConfigurationModel
      displays: { height: number }[]
    }
    result: string
  }[]
  model: LGV
  offset: number
}) {
  return (
    <>
      {displayResults.map(({ track, result }) => {
        const current = offset
        const trackName =
          getConf(track, 'name') ||
          `Reference sequence (${
            readConfObject(getParent(track.configuration), 'displayName') ||
            readConfObject(getParent(track.configuration), 'name')
          })`
        const display = track.displays[0]
        offset += display.height + paddingHeight + textHeight
        return (
          <g
            key={track.configuration.trackId}
            transform={`translate(0 ${current})`}
          >
            <text fontSize={fontSize} x={Math.max(-model.offsetPx, 0)}>
              {trackName}
            </text>
            <g transform={`translate(0 ${textHeight})`}>
              {result}
              <SVGRegionSeparators model={model} height={display.height} />
            </g>
          </g>
        )
      })}
    </>
  )
}

// render LGV to SVG
export async function renderToSvg(model: LGV, opts: ExportSvgOptions) {
  await when(() => model.initialized)
  const { width, tracks, showCytobands } = model
  const shift = 50
  const offset =
    headerHeight +
    rulerHeight +
    (showCytobands ? cytobandHeightIfExists : 0) +
    20
  const height = totalHeight(tracks) + offset
  const displayResults = await Promise.all(
    tracks.map(async track => {
      const display = track.displays[0]
      await when(() => (display.ready !== undefined ? display.ready : true))
      const result = await display.renderSvg(opts)
      return { track, result }
    }),
  )

  // the xlink namespace is used for rendering <image> tag
  return renderToStaticMarkup(
    <svg
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={[0, 0, width + shift * 2, height].toString()}
    >
      {/* background white */}
      <rect width={width + shift * 2} height={height} fill="white" />

      <g stroke="none" transform={`translate(${shift} ${fontSize})`}>
        <SVGHeader model={model} />
        <SVGTracks
          model={model}
          displayResults={displayResults}
          offset={offset}
        />
      </g>
    </svg>,
  )
}
