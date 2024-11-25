import React, { lazy, Suspense, useEffect, useRef } from 'react'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'
import type { LinearGenomeViewModel } from '..'

const ImportForm = lazy(() => import('./ImportForm'))
const NoTracksActiveButton = lazy(() => import('./NoTracksActiveButton'))

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

const LinearGenomeView = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { tracks, error, initialized, hasDisplayedRegions } = model
  const ref = useRef<HTMLDivElement>(null)
  const session = getSession(model)
  const { classes } = useStyles()
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
      <HeaderComponent model={model} />
      <MiniControlsComponent model={model} />
      <TracksContainer model={model}>
        {!tracks.length ? (
          <Suspense fallback={<React.Fragment />}>
            <NoTracksActiveButton model={model} />
          </Suspense>
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
