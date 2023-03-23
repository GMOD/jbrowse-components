import React, { lazy, useState, Suspense } from 'react'
import {
  IconButton,
  IconButtonProps as IconButtonPropsType,
  Paper,
  SvgIconProps,
  Typography,
  useTheme,
  alpha,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import MenuIcon from '@mui/icons-material/Menu'
import { observer } from 'mobx-react'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { Menu, Logomark } from '@jbrowse/core/ui'
import { getSession, useWidthSetter } from '@jbrowse/core/util'

const AboutDialog = lazy(() => import('./AboutDialog'))

const useStyles = makeStyles()(theme => ({
  viewContainer: {
    overflow: 'hidden',
    background: theme.palette.secondary.main,
    margin: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)} ${theme.spacing(1)}`,
  },
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

const ViewMenu = observer(function ({
  model,
  IconButtonProps,
  IconProps,
}: {
  model: IBaseViewModel
  IconButtonProps: IconButtonPropsType
  IconProps: SvgIconProps
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement>()

  if (!model.menuItems()?.length) {
    return null
  }

  return (
    <>
      <IconButton
        {...IconButtonProps}
        aria-label="more"
        aria-controls="view-menu"
        aria-haspopup="true"
        onClick={event => setAnchorEl(event.currentTarget)}
        data-testid="view_menu_icon"
      >
        <MenuIcon {...IconProps} />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onMenuItemClick={(_, callback) => {
          callback()
          setAnchorEl(undefined)
        }}
        onClose={() => setAnchorEl(undefined)}
        menuItems={model.menuItems()}
      />
    </>
  )
})

const ViewContainer = observer(function ({
  view,
  children,
}: {
  view: IBaseViewModel
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const session = getSession(view)
  const [dlgOpen, setDlgOpen] = useState(false)
  const theme = useTheme()
  const ref = useWidthSetter(view, theme.spacing(1))
  const { displayName } = view

  return (
    <Paper elevation={12} ref={ref} className={classes.viewContainer}>
      {session.DialogComponent ? (
        <Suspense fallback={<div />}>
          <session.DialogComponent {...session.DialogProps} />
        </Suspense>
      ) : null}
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
      </div>
      <Paper>{children}</Paper>
      {dlgOpen ? (
        <Suspense fallback={<div />}>
          <AboutDialog open onClose={() => setDlgOpen(false)} />
        </Suspense>
      ) : null}
    </Paper>
  )
})

export default ViewContainer
