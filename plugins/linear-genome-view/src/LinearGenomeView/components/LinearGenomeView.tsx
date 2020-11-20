import { renderToStaticMarkup } from 'react-dom/server'

// material ui things
import Button from '@material-ui/core/Button'
import Paper from '@material-ui/core/Paper'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/core/styles'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// misc
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import { getConf } from '@jbrowse/core/configuration'

// locals
import { LinearGenomeViewStateModel } from '..'
import Header from './Header'
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'
import ImportForm from './ImportForm'
import MiniControls from './MiniControls'
import AboutDialog from './AboutDialog'
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

export default observer((props: { model: LGV }) => {
  const { model } = props
  const { tracks, error, hideHeader, initialized } = model
  const classes = useStyles()

  // the AboutDialog is shown at this level because if it is
  // rendered as a child of the TracksContainer, then clicking on
  // the dialog scrolls the LGV
  const aboutTrack = model.tracks.find(t => t.showAbout)
  const handleClose = () => {
    aboutTrack.setShowAbout(false)
  }
  return !initialized ? (
    <ImportForm model={model} />
  ) : (
    <div style={{ position: 'relative' }}>
      {aboutTrack ? (
        <AboutDialog model={aboutTrack} handleClose={handleClose} />
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

export async function renderToSvg(model: LGV) {
  let offset = 20
  const { width } = model
  return renderToStaticMarkup(
    <svg
      width={width}
      height={1000}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={[0, 0, width, 1000].toString()}
    >
      {model.dynamicBlocks.map(block => {
        const offsetLeft = block.offsetPx - model.offsetPx
        return (
          <g key={block.key} transform={`translate(${offsetLeft} 0)`}>
            <Ruler
              start={block.start}
              end={block.end}
              bpPerPx={model.bpPerPx}
              reversed={block.reversed}
            />
          </g>
        )
      })}
      {
        await Promise.all(
          model.tracks.map(async track => {
            const current = offset
            const trackId = getConf(track, 'trackId')
            const display = track.displays[0]
            offset += display.height + 20
            return (
              <g key={trackId} transform={`translate(0 ${current})`}>
                {await display.renderSvg()}
              </g>
            )
          }),
        )
      }
    </svg>,
  )
}
