import { renderToStaticMarkup } from 'react-dom/server'

// material ui things
import Button from '@material-ui/core/Button'
import Paper from '@material-ui/core/Paper'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/core/styles'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// misc
import { when } from 'mobx'
import { observer } from 'mobx-react'
import { getParent, Instance } from 'mobx-state-tree'
import React from 'react'
import { getConf, readConfObject } from '@jbrowse/core/configuration'

// locals
import { LinearGenomeViewStateModel } from '..'
import Header from './Header'
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'
import ImportForm from './ImportForm'
import MiniControls from './MiniControls'
import AboutDialog from './AboutDialog'
import SequenceDialog from './SequenceDialog'
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
  const {
    tracks,
    error,
    hideHeader,
    initialized,
    hasDisplayedRegions,
    DialogComponent,
  } = model
  const classes = useStyles()

  // the AboutDialog is shown at this level because if it is
  // rendered as a child of the TracksContainer, then clicking on
  // the dialog scrolls the LGV
  const aboutTrack = model.tracks.find(track => track.showAbout)
  const dialogTrack = model.tracks.find(track => track.DialogComponent)

  if (!initialized) {
    return null
  }
  if (!hasDisplayedRegions) {
    return <ImportForm model={model} />
  }
  return (
    <div style={{ position: 'relative' }}>
      {DialogComponent ? (
        <DialogComponent
          view={model}
          handleClose={() => {
            model.setDialogComponent(undefined)
          }}
        />
      ) : null}
      {aboutTrack ? (
        <AboutDialog
          model={aboutTrack}
          handleClose={() => aboutTrack.setShowAbout(false)}
        />
      ) : null}

      {dialogTrack ? (
        <dialogTrack.DialogComponent
          track={dialogTrack}
          display={dialogTrack.DialogDisplay}
          handleClose={() =>
            dialogTrack.setDialogComponent(undefined, undefined)
          }
        />
      ) : null}
      {model.isSeqDialogDisplayed ? (
        <SequenceDialog
          model={model}
          handleClose={() => {
            model.setOffsets(undefined, undefined)
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
        x={(x1 - x0) / 2}
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
  rulerHeight,
  width,
}: {
  model: LGV
  rulerHeight: number
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
    <g transform={`translate(0 ${rulerHeight})`}>
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
    </g>
  )
}

export async function renderToSvg(
  model: LGV,
  opts: { fullSvg: boolean } = { fullSvg: true },
) {
  const fontSize = 15
  const textHeight = fontSize + 5
  const paddingHeight = 20
  const headerHeight = textHeight + 20
  const rulerHeight = 50
  await when(() => model.initialized)
  const { width, tracks, assemblyNames, dynamicBlocks } = model
  let offset = headerHeight + rulerHeight + 20
  const initialOffset = headerHeight + rulerHeight + 20
  const height =
    tracks.reduce((accum, track) => {
      const display = track.displays[0]
      return accum + display.height + 20 + textHeight
    }, 0) + offset

  const assemblyName = assemblyNames.length > 1 ? '' : assemblyNames[0]
  const shift = 50
  return renderToStaticMarkup(
    <svg
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={[0, 0, width + shift * 2, height].toString()}
    >
      <rect width={width + shift * 2} height={height} fill="white" />
      <g stroke="none" transform={`translate(${shift} ${fontSize})`}>
        <text x={0} y={fontSize} fontSize={fontSize}>
          {assemblyName}
        </text>
        <g transform={`translate(0 ${fontSize})`}>
          <ScaleBar model={model} fontSize={fontSize} />
        </g>
        <SVGRuler
          model={model}
          fontSize={fontSize}
          rulerHeight={rulerHeight}
          width={width}
        />

        {
          await Promise.all(
            tracks.map(async track => {
              const current = offset
              const trackName =
                getConf(track, 'name') ||
                `Reference sequence (${readConfObject(
                  getParent(track.configuration),
                  'name',
                )})`
              const display = track.displays[0]
              offset += display.height + paddingHeight + textHeight
              await when(() =>
                display.ready !== undefined ? display.ready : true,
              )

              return (
                <g key={track.trackId} transform={`translate(0 ${current})`}>
                  <text fontSize={fontSize}>{trackName}</text>
                  <g transform={`translate(0 ${textHeight})`}>
                    {await display.renderSvg(opts)}
                  </g>
                </g>
              )
            }),
          )
        }
        {dynamicBlocks.contentBlocks.slice(1).map(block => {
          return (
            <line
              key={block.key}
              x1={block.offsetPx - model.offsetPx}
              x2={block.offsetPx - model.offsetPx}
              y1={initialOffset}
              y2={height}
              stroke="black"
              strokeOpacity={0.3}
            />
          )
        })}
      </g>
    </svg>,
  )
}
