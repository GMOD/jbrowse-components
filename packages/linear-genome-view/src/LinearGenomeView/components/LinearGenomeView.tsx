import { getSession, isSessionModelWithWidgets } from '@gmod/jbrowse-core/util'
import { renderToStaticMarkup } from 'react-dom/server'

// material ui things
import Button from '@material-ui/core/Button'
import Paper from '@material-ui/core/Paper'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/core/styles'

// misc
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import { getConf } from '@gmod/jbrowse-core/configuration'

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
}))

export default observer((props: { model: LGV }) => {
  const { model } = props
  const { tracks, error, hideHeader, initialized } = model
  const classes = useStyles()
  const session = getSession(model)

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
            zIndex: 100000,
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
        <TracksContainer model={model}>
          {!tracks.length ? (
            <Paper variant="outlined" className={classes.errorMessage}>
              <Typography>No tracks active.</Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={model.activateTrackSelector}
                disabled={
                  isSessionModelWithWidgets(session) &&
                  session.visibleWidget &&
                  session.visibleWidget.id === 'hierarchicalTrackSelector' &&
                  // @ts-ignore
                  session.visibleWidget.view.id === model.id
                }
              >
                Select Tracks
              </Button>
            </Paper>
          ) : (
            tracks.map(track => (
              <TrackContainer key={track.id} model={model} track={track} />
            ))
          )}
        </TracksContainer>
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
            offset += track.height + 20
            const trackId = getConf(track, 'trackId')
            return (
              <g key={trackId} transform={`translate(0 ${current})`}>
                {await track.renderSvg()}
              </g>
            )
          }),
        )
      }
    </svg>,
  )
}
