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
    // A floor rather than a height, and the same one the web app's view header
    // has: the LGV header below sticks past this bar, so a title box of some
    // other size has to *move* the boxes below it rather than be clipped to fit
    // them. `useChromeHeightVar` publishes what this measures and they read it;
    // the constant is only what they fall back to. This bar's own content wants
    // 32px, so it is the floor that gives way, not the content.
    minHeight: VIEW_HEADER_HEIGHT,
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
