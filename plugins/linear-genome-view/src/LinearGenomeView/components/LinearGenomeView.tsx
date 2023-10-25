import React, { lazy, useEffect, useRef } from 'react'
import { Button, Paper, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

// icons
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

// locals
import { LinearGenomeViewModel } from '..'
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'

const ImportForm = lazy(() => import('./ImportForm'))

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  note: {
    textAlign: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  rel: {
    position: 'relative',
  },
  top: {
    zIndex: 1000,
  },
}))

function NoTracksActive({ model }: { model: LinearGenomeViewModel }) {
  const { classes } = useStyles()
  const { hideNoTracksActive } = model
  return (
    <Paper className={classes.note}>
      {!hideNoTracksActive ? (
        <>
          <Typography>No tracks active.</Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => model.activateTrackSelector()}
            className={classes.top}
            startIcon={<TrackSelectorIcon />}
          >
            Open track selector
          </Button>
        </>
      ) : (
        <div style={{ height: '48px' }}></div>
      )}
    </Paper>
  )
}

const LinearGenomeView = observer(({ model }: { model: LGV }) => {
  const { tracks, error, initialized, hasDisplayedRegions } = model
  const ref = useRef<HTMLDivElement>(null)
  const session = getSession(model)
  const { classes } = useStyles()

  useEffect(() => {
    // sets the focused view id based on a click within the LGV;
    // necessary for subviews to be focused properly
    function handleSelectView(e: Event) {
      if (e.target instanceof Element && ref?.current?.contains(e.target)) {
        session.setFocusedViewId?.(model.id)
      }
    }

    document.addEventListener('mousedown', handleSelectView)
    document.addEventListener('keydown', handleSelectView)
    return () => {
      document.removeEventListener('mousedown', handleSelectView)
      document.removeEventListener('keydown', handleSelectView)
    }
  }, [session, model])

  if (!initialized && !error) {
    return <LoadingEllipses variant="h6" />
  }
  if (!hasDisplayedRegions || error) {
    return <ImportForm model={model} />
  }

  const MiniControlsComponent = model.MiniControlsComponent()
  const HeaderComponent = model.HeaderComponent()

  return (
    <div
      className={classes.rel}
      ref={ref}
      onMouseLeave={() => session.setHovered(undefined)}
      onMouseMove={event => {
        const c = ref.current
        if (!c) {
          return
        }
        const { tracks } = model
        const leftPx = event.clientX - c.getBoundingClientRect().left
        const hoverPosition = model.pxToBp(leftPx)
        const hoverFeature = tracks.find(t => t.displays[0].featureUnderMouse)
        session.setHovered({ hoverPosition, hoverFeature })
      }}
    >
      <HeaderComponent model={model} />
      <MiniControlsComponent model={model} />
      <TracksContainer model={model}>
        {!tracks.length ? (
          <NoTracksActive model={model} />
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
