import React, { lazy, useEffect, useRef } from 'react'
import { Button, Paper, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// icons
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// locals
import { LinearGenomeViewModel } from '..'
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'
import { getSession } from '@jbrowse/core/util'

const ImportForm = lazy(() => import('./ImportForm'))

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  note: {
    textAlign: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
}))

const LinearGenomeView = observer(({ model }: { model: LGV }) => {
  const { tracks, error, initialized, hasDisplayedRegions } = model
  const { classes } = useStyles()
  const ref = useRef<HTMLDivElement>(null)
  const session = getSession(model)

  useEffect(() => {
    // sets the focused view id based on a click within the LGV; necessary for subviews to be focused properly
    function handleSelectView(e: Event) {
      if (e.target instanceof Element) {
        if (ref?.current && ref.current.contains(e.target)) {
          session.setFocusedViewId(model.id)
        }
      }
    }

    document.addEventListener('mousedown', handleSelectView)
    document.addEventListener('keydown', handleSelectView)
    return () => {
      document.removeEventListener('mousedown', handleSelectView)
      document.removeEventListener('keydown', handleSelectView)
    }
  }, [ref, session, model])

  if (!initialized && !error) {
    return <LoadingEllipses variant="h6" />
  }
  if (!hasDisplayedRegions || error) {
    return <ImportForm model={model} />
  }

  const MiniControlsComponent = model.MiniControlsComponent()
  const HeaderComponent = model.HeaderComponent()

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <HeaderComponent model={model} />
      <MiniControlsComponent model={model} />
      <TracksContainer model={model}>
        {!tracks.length ? (
          <Paper variant="outlined" className={classes.note}>
            {!model.hideNoTracksActive ? (
              <>
                <Typography>No tracks active.</Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={model.activateTrackSelector}
                  style={{ zIndex: 1000 }}
                  startIcon={<TrackSelectorIcon />}
                >
                  Open track selector
                </Button>
              </>
            ) : (
              <div style={{ height: '48px' }}></div>
            )}
          </Paper>
        ) : (
          tracks.map(track => (
            <TrackContainer key={track.id} model={model} track={track} />
          ))
        )}
      </TracksContainer>
    </div>
  )
})

export default LinearGenomeView
