import React, { Suspense, lazy, useEffect, useRef } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'

import type { LinearGenomeViewModel } from '..'

// lazies
const ImportForm = lazy(() => import('./ImportForm'))
const NoTracksActiveButton = lazy(() => import('./NoTracksActiveButton'))

const useStyles = makeStyles()({
  rel: {
    position: 'relative',
  },
  top: {
    zIndex: 1000,
  },
})

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
  const { tracks } = model
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
