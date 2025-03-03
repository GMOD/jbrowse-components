import { Suspense, lazy, useEffect, useRef } from 'react'

import { LoadingEllipses, VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import Paper from '@mui/material/Paper'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'
import {
  HEADER_BAR_HEIGHT,
  HEADER_OVERVIEW_HEIGHT,
  SCALE_BAR_HEIGHT,
} from '../consts'

import type { LinearGenomeViewModel } from '..'

// lazies
const ImportForm = lazy(() => import('./ImportForm'))
const NoTracksActiveButton = lazy(() => import('./NoTracksActiveButton'))

const useStyles = makeStyles()(theme => ({
  header: {
    background: theme.palette.background.paper,
    top: VIEW_HEADER_HEIGHT,
    zIndex: 850,
  },
  pinnedTracks: {
    position: 'sticky',
    zIndex: 3,
  },
  rel: {
    position: 'relative',
  },
}))

const LinearGenomeView = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { error, initialized, hasDisplayedRegions } = model

  if (!initialized && !error) {
    return <LoadingEllipses variant="h6" />
  } else if (!hasDisplayedRegions || error) {
    return <ImportForm model={model} />
  } else {
    return <LinearGenomeViewContainer model={model} />
  }
})

const LinearGenomeViewContainer = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { pinnedTracks, tracks, unpinnedTracks } = model
  const { classes } = useStyles()
  const session = getSession(model)
  const ref = useRef<HTMLDivElement>(null)
  const MiniControlsComponent = model.MiniControlsComponent()
  const HeaderComponent = model.HeaderComponent()
  useEffect(() => {
    // sets the focused view id based on a click within the LGV;
    // necessary for subviews to be focused properly
    function handleSelectView(e: Event) {
      if (e.target instanceof Element && ref.current?.contains(e.target)) {
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

  let pinnedTracksTop = 0
  if (session.stickyViewHeaders) {
    pinnedTracksTop = VIEW_HEADER_HEIGHT + SCALE_BAR_HEIGHT
    if (!model.hideHeader) {
      pinnedTracksTop += HEADER_BAR_HEIGHT
      if (!model.hideHeaderOverview) {
        pinnedTracksTop += HEADER_OVERVIEW_HEIGHT
      }
    }
  }

  return (
    <div
      className={classes.rel}
      ref={ref}
      onMouseLeave={() => {
        session.setHovered(undefined)
      }}
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
      <div
        className={classes.header}
        style={{ position: session.stickyViewHeaders ? 'sticky' : undefined }}
      >
        <HeaderComponent model={model} />
        <MiniControlsComponent model={model} />
      </div>
      <TracksContainer model={model}>
        {!tracks.length ? (
          <Suspense fallback={null}>
            <NoTracksActiveButton model={model} />
          </Suspense>
        ) : (
          <>
            {pinnedTracks.length ? (
              <Paper
                elevation={6}
                className={classes.pinnedTracks}
                style={{ top: pinnedTracksTop }}
              >
                {pinnedTracks.map(track => (
                  <TrackContainer key={track.id} model={model} track={track} />
                ))}
              </Paper>
            ) : null}
            {unpinnedTracks.map(track => (
              <TrackContainer key={track.id} model={model} track={track} />
            ))}
          </>
        )}
      </TracksContainer>
    </div>
  )
})

export default LinearGenomeView
