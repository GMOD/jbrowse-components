import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { when } from 'mobx'
import { getParent } from 'mobx-state-tree'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { ContentBlock } from '@jbrowse/core/util/blockTypes'

// locals
import Ruler from './Ruler'
import {
  LinearGenomeViewModel,
  ExportSvgOptions,
  HEADER_OVERVIEW_HEIGHT,
} from '..'
import Base1DView, { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

type LGV = LinearGenomeViewModel

function getBpDisplayStr(totalBp: number) {
  let displayBp
  if (Math.floor(totalBp / 1000000) > 0) {
    displayBp = `${parseFloat((totalBp / 1000000).toPrecision(3))}Mbp`
  } else if (Math.floor(totalBp / 1000) > 0) {
    displayBp = `${parseFloat((totalBp / 1000).toPrecision(3))}Kbp`
  } else {
    displayBp = `${Math.floor(totalBp)}bp`
  }
  return displayBp
}

const colorMap: { [key: string]: string | undefined } = {
  gneg: '#ccc',
  gpos25: '#aaa',
  gpos50: '#888',
  gpos100: '#333',
  gpos75: '#666',
  gvar: 'black',
  stalk: 'brown',
  acen: '#800',
}

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
        const offsetLeft = block.offsetPx - viewOffsetPx
        return (
          <g key={`${block.key}`} transform={`translate(${offsetLeft} 0)`}>
            <text x={offsetLeft / bpPerPx} y={fontSize} fontSize={fontSize}>
              {block.refName}
            </text>
            {renderRuler ? (
              <g transform="translate(0 20)" clipPath="url(#clip-ruler)">
                <Ruler
                  start={block.start}
                  end={block.end}
                  bpPerPx={bpPerPx}
                  reversed={block.reversed}
                />
              </g>
            ) : (
              <line
                strokeWidth={1}
                stroke="black"
                x1={block.start / bpPerPx}
                x2={block.end / bpPerPx}
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
  const { width, assemblyNames, showIdeogram, displayedRegions } = model
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

  const cytobandHeight = showIdeogram ? cytobandHeightIfExists : 0

  return (
    <g id="header">
      <text x={0} y={fontSize} fontSize={fontSize}>
        {assemblyName}
      </text>

      {showIdeogram ? (
        <g transform={`translate(0 ${rulerHeight})`}>
          <Cytobands overview={overview} assembly={assembly} block={block} />
          <rect
            stroke="red"
            fill="none"
            width={lastOverviewPx - firstOverviewPx}
            height={HEADER_OVERVIEW_HEIGHT - 2}
            x={firstOverviewPx}
            y={0}
          />
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

const Cytobands = ({
  overview,
  block,
  assembly,
}: {
  overview: Base1DViewModel
  assembly?: Assembly
  block: ContentBlock
}) => {
  const cytobands = assembly?.cytobands
    ?.map(f => ({
      refName: assembly.getCanonicalRefName(f.get('refName')),
      start: f.get('start'),
      end: f.get('end'),
      type: f.get('type'),
    }))
    .filter(f => f.refName === block.refName)
    .map(f => [
      overview.bpToPx({
        refName: f.refName,
        coord: f.start,
      }),
      overview.bpToPx({
        refName: f.refName,
        coord: f.end,
      }),
      f.type,
    ])

  let firstCent = true
  return cytobands ? (
    <svg style={{ width: '100%' }}>
      <g transform={`translate(-${block.offsetPx})`}>
        {cytobands.map(([start, end, type]) => {
          if (type === 'acen' && firstCent) {
            firstCent = false
            return (
              <polygon
                key={start + '-' + end + '-' + type}
                points={[
                  [start, 0],
                  [end, (HEADER_OVERVIEW_HEIGHT - 2) / 2],
                  [start, HEADER_OVERVIEW_HEIGHT - 2],
                ].toString()}
                fill={colorMap[type]}
              />
            )
          }
          if (type === 'acen' && !firstCent) {
            return (
              <polygon
                key={start + '-' + end + '-' + type}
                points={[
                  [start, (HEADER_OVERVIEW_HEIGHT - 2) / 2],
                  [end, 0],
                  [end, HEADER_OVERVIEW_HEIGHT - 2],
                ].toString()}
                fill={colorMap[type]}
              />
            )
          }
          return (
            <rect
              key={start + '-' + end + '-' + type}
              x={Math.min(start, end)}
              y={0}
              width={Math.abs(end - start)}
              height={HEADER_OVERVIEW_HEIGHT - 2}
              fill={colorMap[type]}
            />
          )
        })}
      </g>
    </svg>
  ) : null
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
          `Reference sequence (${readConfObject(
            getParent(track.configuration),
            'name',
          )})`
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
  const { width, tracks, showIdeogram } = model
  const shift = 50
  const offset =
    headerHeight +
    rulerHeight +
    (showIdeogram ? cytobandHeightIfExists : 0) +
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
