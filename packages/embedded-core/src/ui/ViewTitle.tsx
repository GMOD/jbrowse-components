import React, { Suspense, lazy, useState } from 'react'
import { IconButton, Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { Logomark } from '@jbrowse/core/ui'
import ViewMenu from './ViewMenu'
import { makeStyles } from 'tss-react/mui'
import { getSession } from '@jbrowse/core/util'

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

export default observer(({ view }: { view: IBaseViewModel }) => {
  const { classes } = useStyles()
  const { displayName } = view
  const [dlgOpen, setDlgOpen] = useState(false)
  const session = getSession(view)
  return (
    <div style={{ display: 'flex' }}>
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
      <IconButton onClick={() => setDlgOpen(true)}>
        <div style={{ width: 22, height: 22 }}>
          <Logomark variant="white" />
        </div>
      </IconButton>
      {dlgOpen ? (
        <Suspense fallback={<div />}>
          <VersionAboutDialog
            open
            onClose={() => setDlgOpen(false)}
            version={session.version}
          />
        </Suspense>
      ) : null}
    </div>
  )
})
