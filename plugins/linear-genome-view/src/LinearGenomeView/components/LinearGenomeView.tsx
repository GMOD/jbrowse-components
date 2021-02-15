import { renderToStaticMarkup } from 'react-dom/server'

// material ui things
import Button from '@material-ui/core/Button'
import Paper from '@material-ui/core/Paper'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/core/styles'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// misc
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
  const { tracks, error, hideHeader, initialized, hasDisplayedRegions } = model
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

export async function renderToSvg(model: LGV) {
  const fontSize = 15
  const textHeight = fontSize + 5
  const paddingHeight = 20
  const headerHeight = textHeight + 20
  let offset = headerHeight + 20
  const height =
    model.tracks.reduce((accum, track) => {
      const display = track.displays[0]
      return accum + display.height + 20 + textHeight
    }, 0) + offset
  const { width, offsetPx: viewOffsetPx, bpPerPx } = model
  const renderRuler = model.dynamicBlocks.contentBlocks.length < 5
  return renderToStaticMarkup(
    <svg
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={[0, 0, width, height].toString()}
    >
      {model.dynamicBlocks.contentBlocks.map(block => {
        const offsetLeft = block.offsetPx - viewOffsetPx
        return (
          <g key={block.key} transform={`translate(${offsetLeft} 0)`}>
            <text x={offsetLeft / bpPerPx} y={fontSize} fontSize={fontSize}>
              {block.refName}
            </text>
            {renderRuler ? (
              <g transform="translate(0 20)">
                <Ruler
                  start={block.start}
                  end={block.end}
                  bpPerPx={model.bpPerPx}
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
      {
        await Promise.all(
          model.tracks.map(async track => {
            const current = offset
            const trackId = getConf(track, 'trackId')
            const trackName =
              getConf(track, 'name') ||
              `Reference sequence (${readConfObject(
                getParent(track.configuration),
                'name',
              )})`
            const display = track.displays[0]
            offset += display.height + paddingHeight + textHeight

            // uses svg text background from
            // https://stackoverflow.com/questions/15500894/
            return (
              <g key={trackId} transform={`translate(0 ${current})`}>
                <text fontSize={fontSize}>{trackName}</text>
                <g transform={`translate(0 ${textHeight})`}>
                  {await display.renderSvg()}
                </g>
              </g>
            )
          }),
        )
      }
    </svg>,
  )
}
