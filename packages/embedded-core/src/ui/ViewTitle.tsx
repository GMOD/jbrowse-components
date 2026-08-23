import { Suspense, lazy, useRef, useState } from 'react'

import {
  CascadingMenuButton,
  Logomark,
  VIEW_HEADER_HEIGHT,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  VIEW_HEADER_HEIGHT_VAR,
  useChromeHeightVar,
} from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MenuIcon from '@mui/icons-material/Menu'
import { IconButton, Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'

const VersionAboutDialog = lazy(() => import('./VersionAboutDialog.tsx'))

const useStyles = makeStyles()(theme => ({
  icon: {
    color: theme.palette.secondary.contrastText,
  },
  displayName: {
    marginTop: 2,
    color: theme.palette.secondary.contrastText,
  },
  grow: {
    flexGrow: 1,
  },
  container: {
    display: 'flex',
    alignItems: 'center',
    // A fixed height, unlike the web app's view header, which is a floor. Both
    // publish what they measure through `useChromeHeightVar`, so what sticks
    // below follows either — this is a density choice and no longer a
    // load-bearing constant. It stays fixed because the content that would
    // widen the box is the logomark button, whose 22px icon and 5px padding
    // want 32: a floor here spends 4px of an embedder's box to stop that button
    // painting 2px outside a bar nothing clips.
    height: VIEW_HEADER_HEIGHT,
    top: 0,
    zIndex: 900,
    // a sticky element does not carry its parent's background, and what would
    // otherwise show through is the tracks scrolling underneath
    background: theme.palette.secondary.main,
  },
  iconRoot: {
    '&:hover': {
      backgroundColor: alpha(
        theme.palette.secondary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
}))

const ViewTitle = observer(function ViewTitle({
  view,
}: {
  view: IBaseViewModel
}) {
  const { classes } = useStyles()
  const { displayName } = view
  const [dialogOpen, setDialogOpen] = useState(false)
  const session = getSession(view)
  // `=== true` because the member is optional on AbstractSessionModel: a
  // session with no such notion reads as "don't pin", which is what the LGV
  // model's own getter does with it too
  const stickyViewHeaders = session.stickyViewHeaders === true
  const ref = useRef<HTMLDivElement>(null)
  useChromeHeightVar(ref, VIEW_HEADER_HEIGHT_VAR)
  return (
    <div
      ref={ref}
      className={classes.container}
      style={{ position: stickyViewHeaders ? 'sticky' : undefined }}
    >
      <CascadingMenuButton
        menuItems={() => view.menuItems()}
        data-testid="view_menu_icon"
        classes={{ root: classes.iconRoot }}
        edge="start"
      >
        <MenuIcon className={classes.icon} />
      </CascadingMenuButton>
      <div className={classes.grow} />
      {displayName ? (
        <Typography variant="body2" className={classes.displayName}>
          {displayName}
        </Typography>
      ) : null}
      <div className={classes.grow} />
      <IconButton
        onClick={() => {
          setDialogOpen(true)
        }}
      >
        <div style={{ width: 22, height: 22 }}>
          <Logomark variant="white" />
        </div>
      </IconButton>
      {dialogOpen ? (
        <Suspense fallback={null}>
          <VersionAboutDialog
            open
            onClose={() => {
              setDialogOpen(false)
            }}
            version={session.version}
          />
        </Suspense>
      ) : null}
    </div>
  )
})

export default ViewTitle
