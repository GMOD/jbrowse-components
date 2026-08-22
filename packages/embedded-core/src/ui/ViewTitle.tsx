import { Suspense, lazy, useState } from 'react'

import {
  CascadingMenuButton,
  Logomark,
  VIEW_HEADER_HEIGHT,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
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
    // VIEW_HEADER_HEIGHT, not this bar's natural 32px, and the height is what
    // makes it pinnable rather than a style choice: the LGV header below it
    // sticks at `top: VIEW_HEADER_HEIGHT` and `rubberbandTop` measures the
    // pinned stack from the same constant, so a title of any other height
    // leaves a band of scrolled track above the header and puts every overlay
    // off by the difference. Same height the web app's view header has.
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
  return (
    <div
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
