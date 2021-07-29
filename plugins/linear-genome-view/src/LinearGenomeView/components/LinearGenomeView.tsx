import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// material ui things
import { Button, Paper, Typography, makeStyles } from '@material-ui/core'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// misc
import { when } from 'mobx'
import { observer } from 'mobx-react'
import { getParent, Instance } from 'mobx-state-tree'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

// locals
import { LinearGenomeViewStateModel, ExportSvgOptions } from '..'
import Header from './Header'
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'
import ImportForm from './ImportForm'
import MiniControls from './MiniControls'
import SequenceDialog from './SequenceDialog'
import SearchResultsDialog from './SearchResultsDialog'
import Ruler from './Ruler'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  errorMessage: {
    textAlign: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  spacer: {
    marginRight: theme.spacing(2),
  },
}))

const LinearGenomeView = observer(({ model }: { model: LGV }) => {
  const { tracks, error, hideHeader, initialized, hasDisplayedRegions } = model
  const classes = useStyles()

  if (!initialized) {
    return null
  }
  if (!hasDisplayedRegions) {
    return <ImportForm model={model} />
  }
  return (
    <div style={{ position: 'relative' }}>
      {model.isSeqDialogDisplayed ? (
        <SequenceDialog
          model={model}
          handleClose={() => {
            model.setOffsets(undefined, undefined)
          }}
        />
      ) : null}
      {model.isSearchDialogDisplayed ? (
        <SearchResultsDialog
          model={model}
          handleClose={() => {
            model.setSearchResults(undefined, undefined)
          }}
        />
      ) : null}
      {!hideHeader ? (
        <Header model={model} />
      ) : (
        <div
          style={{
            position: 'absolute',
            right: 0,
            zIndex: 1001,
          }}
        >
          <MiniControls model={model} />
        </div>
      )}
      {error ? (
        <Paper variant="outlined" className={classes.errorMessage}>
          <Typography color="error">{error.message}</Typography>
        </Paper>
      ) : (
        <>
          <TracksContainer model={model}>
            {!tracks.length ? (
              <Paper variant="outlined" className={classes.errorMessage}>
                <Typography>No tracks active.</Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={model.activateTrackSelector}
                  style={{ zIndex: 1000 }}
                >
                  <TrackSelectorIcon className={classes.spacer} />
                  Open track selector
                </Button>
              </Paper>
            ) : (
              tracks.map(track => (
                <TrackContainer key={track.id} model={model} track={track} />
              ))
            )}
          </TracksContainer>
        </>
      )}
    </div>
  )
})

export default LinearGenomeView

function ScaleBar({ model, fontSize }: { model: LGV; fontSize: number }) {
  const {
    offsetPx,
    dynamicBlocks: { totalWidthPxWithoutBorders: totalWidthPx, totalBp },
  } = model
  let displayBp
  if (Math.floor(totalBp / 1000000) > 0) {
    displayBp = `${parseFloat((totalBp / 1000000).toPrecision(3))}Mbp`
  } else if (Math.floor(totalBp / 1000) > 0) {
    displayBp = `${parseFloat((totalBp / 1000).toPrecision(3))}Kbp`
  } else {
    displayBp = `${Math.floor(totalBp)}bp`
  }
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

const totalHeight = (tracks: { displays: { height: number }[] }[]) => {
  return tracks.reduce((accum, track) => {
    const display = track.displays[0]
    return accum + display.height + paddingHeight + textHeight
  }, 0)
}

// SVG component, ruler and assembly name
const SVGHeader = ({ model }: { model: LGV }) => {
  const { width, assemblyNames } = model
  const assemblyName = assemblyNames.length > 1 ? '' : assemblyNames[0]
  return (
    <g id="header">
      <text x={0} y={fontSize} fontSize={fontSize}>
        {assemblyName}
      </text>
      <g transform={`translate(0 ${fontSize})`}>
        <ScaleBar model={model} fontSize={fontSize} />
      </g>
      <g transform={`translate(0 ${rulerHeight})`}>
        <SVGRuler model={model} fontSize={fontSize} width={width} />
      </g>
    </g>
  )
}

// SVG component, region separator
const SVGRegionSeparators = ({ model }: { model: LGV }) => {
  const { dynamicBlocks, tracks } = model
  const initialOffset = headerHeight + rulerHeight + 20
  const height = totalHeight(tracks)

  return (
    <>
      {dynamicBlocks.contentBlocks.slice(1).map(block => (
        <line
          key={block.key}
          x1={block.offsetPx - model.offsetPx}
          x2={block.offsetPx - model.offsetPx}
          y1={initialOffset}
          y2={height}
          stroke="black"
          strokeOpacity={0.3}
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
            <g transform={`translate(0 ${textHeight})`}>{result}</g>
          </g>
        )
      })}
    </>
  )
}

// render LGV to SVG
export async function renderToSvg(model: LGV, opts: ExportSvgOptions) {
  await when(() => model.initialized)
  const { width, tracks } = model
  const shift = 50
  const offset = headerHeight + rulerHeight + 20
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
        <SVGRegionSeparators model={model} />
      </g>
    </svg>,
  )
}
