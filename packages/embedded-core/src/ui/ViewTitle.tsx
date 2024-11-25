import React, { Suspense, lazy, useState } from 'react'
import { Logomark } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { IconButton, Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import ViewMenu from './ViewMenu'
import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'

const VersionAboutDialog = lazy(() => import('./VersionAboutDialog'))

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
