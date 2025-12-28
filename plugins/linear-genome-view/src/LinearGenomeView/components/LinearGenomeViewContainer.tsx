import { Suspense, lazy, useEffect, useRef } from 'react'

import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import Paper from '@mui/material/Paper'
import { observer } from 'mobx-react'

import tinykeys from '@jbrowse/core/util/tinykeys'

import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'

import type { LinearGenomeViewModel } from '..'

// lazies
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

const LinearGenomeViewContainer = observer(function LinearGenomeViewContainer({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const {
    pinnedTracks,
    stickyViewHeaders,
    pinnedTracksTop,
    tracks,
    unpinnedTracks,
  } = model
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

  // Keyboard navigation for tracks using tinykeys
  useEffect(() => {
    // Helper to check if shortcuts should be handled
    function shouldHandleShortcut(event: KeyboardEvent) {
      // Don't handle if a menu is open
      if (document.querySelector('[role="menu"]')) {
        return false
      }
      // Don't handle if this view is not focused
      if (session.focusedViewId !== model.id) {
        return false
      }
      // Don't handle if in an input
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return false
      }
      return true
    }

    function openTrackMenu() {
      const menuButton = ref.current?.querySelector(
        `[data-track-id="${model.focusedTrackId}"] [data-testid="track_menu_icon"]`,
      ) as HTMLButtonElement | null
      menuButton?.click()
    }

    function openViewMenu() {
      let el = ref.current?.parentElement
      let viewMenuButton: HTMLButtonElement | null = null
      while (el && !viewMenuButton) {
        viewMenuButton = el.querySelector(
          '[data-testid="view_menu_icon"]',
        ) as HTMLButtonElement | null
        el = el.parentElement
      }
      viewMenuButton?.click()
    }

    const unsubscribe = tinykeys(window, {
      'Alt+ArrowDown': event => {
        if (shouldHandleShortcut(event)) {
          event.preventDefault()
          model.focusNextTrack()
        }
      },
      'Alt+ArrowUp': event => {
        if (shouldHandleShortcut(event)) {
          event.preventDefault()
          model.focusPrevTrack()
        }
      },
      Escape: event => {
        if (shouldHandleShortcut(event)) {
          model.clearFocusedTrack()
        }
      },
      m: event => {
        if (shouldHandleShortcut(event) && model.focusedTrackId) {
          event.preventDefault()
          openTrackMenu()
        }
      },
      v: event => {
        if (shouldHandleShortcut(event)) {
          event.preventDefault()
          openViewMenu()
        }
      },
      '=': event => {
        if (shouldHandleShortcut(event)) {
          event.preventDefault()
          model.zoom(model.bpPerPx / 2)
        }
      },
      '+': event => {
        if (shouldHandleShortcut(event)) {
          event.preventDefault()
          model.zoom(model.bpPerPx / 2)
        }
      },
      '-': event => {
        if (shouldHandleShortcut(event)) {
          event.preventDefault()
          model.zoom(model.bpPerPx * 2)
        }
      },
    })

    return unsubscribe
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
      <div
        className={classes.header}
        style={{ position: stickyViewHeaders ? 'sticky' : undefined }}
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

export default LinearGenomeViewContainer
