import React, { lazy, useEffect, useRef } from 'react'
import { makeStyles } from 'tss-react/mui'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

// locals
import { LinearGenomeViewModel } from '..'
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'
import NoTracksActive from './NoTracksActiveButton'

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

const LinearGenomeView = observer(({ model }: { model: LGV }) => {
  const { tracks } = model
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

const LinearGenomeViewWrapper = observer(({ model }: { model: LGV }) => {
  const { error, initialized, hasDisplayedRegions } = model
  if (!initialized && !error) {
    return <LoadingEllipses variant="h6" />
  } else if (!hasDisplayedRegions || error) {
    return <ImportForm model={model} />
  } else {
    return <LinearGenomeView model={model} />
  }
})

export default LinearGenomeViewWrapper
