import React, { Suspense, lazy, useState } from 'react'
import { IconButton, Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { Logomark } from '@jbrowse/core/ui'
import { makeStyles } from 'tss-react/mui'
import { getSession } from '@jbrowse/core/util'

// locals
import ViewMenu from './ViewMenu'

const VersionAboutDialog = lazy(() => import('./VersionAboutDialog'))

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'flex',
  },
  displayName: {
    color: theme.palette.secondary.contrastText,
    marginTop: 2,
  },
  grow: {
    flexGrow: 1,
  },
  icon: {
    color: theme.palette.secondary.contrastText,
  },
  iconRoot: {
    '&:hover': {
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
      backgroundColor: alpha(
        theme.palette.secondary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
    },
  },
}))

const ViewTitle = observer(({ view }: { view: IBaseViewModel }) => {
  const { classes } = useStyles()
  const { displayName } = view
  const [dialogOpen, setDialogOpen] = useState(false)
  const session = getSession(view)
  return (
    <div className={classes.container}>
      <ViewMenu
        model={view}
        IconButtonProps={{
          classes: { root: classes.iconRoot },
          edge: 'start',
        }}
        IconProps={{ className: classes.icon }}
      />
      <div className={classes.grow} />
      {displayName ? (
        <Typography variant="body2" className={classes.displayName}>
          {displayName}
        </Typography>
      ) : null}
      <div className={classes.grow} />
      <IconButton onClick={() => setDialogOpen(true)}>
        <div style={{ height: 22, width: 22 }}>
          <Logomark variant="white" />
        </div>
      </IconButton>
      {dialogOpen ? (
        <Suspense fallback={null}>
          <VersionAboutDialog
            open
            onClose={() => setDialogOpen(false)}
            version={session.version}
          />
        </Suspense>
      ) : null}
    </div>
  )
})

export default ViewTitle
