import React, { useEffect, useState, Suspense } from 'react'
import {
  IconButton,
  IconButtonProps as IconButtonPropsType,
  Paper,
  SvgIconProps,
  Typography,
  makeStyles,
  useTheme,
  fade,
} from '@material-ui/core'
import MenuIcon from '@material-ui/icons/Menu'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import useDimensions from 'react-use-dimensions'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { Menu, Logomark } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'

const useStyles = makeStyles(theme => ({
  viewContainer: {
    overflow: 'hidden',
    background: theme.palette.secondary.main,
    margin: theme.spacing(1),
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
      backgroundColor: fade(
        theme.palette.secondary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
}))

const ViewMenu = observer(
  ({
    model,
    IconButtonProps,
    IconProps,
  }: {
    model: IBaseViewModel
    IconButtonProps: IconButtonPropsType
    IconProps: SvgIconProps
  }) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement>()

    if (!model.menuItems?.length) {
      return null
    }

    return (
      <>
        <IconButton
          {...IconButtonProps}
          aria-label="more"
          aria-controls="view-menu"
          aria-haspopup="true"
          onClick={event => {
            setAnchorEl(event.currentTarget)
          }}
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
          onClose={() => {
            setAnchorEl(undefined)
          }}
          menuItems={model.menuItems}
        />
      </>
    )
  },
)

const ViewContainer = observer(
  ({ view, children }: { view: IBaseViewModel; children: React.ReactNode }) => {
    const classes = useStyles()
    const theme = useTheme()
    const session = getSession(view)
    const [measureRef, { width }] = useDimensions()

    const padWidth = theme.spacing(1)

    useEffect(() => {
      if (width) {
        if (isAlive(view)) {
          view.setWidth(width - padWidth * 2)
        }
      }
    }, [padWidth, view, width])

    return (
      <Paper
        elevation={12}
        ref={measureRef}
        className={classes.viewContainer}
        style={{ padding: `0px ${padWidth}px ${padWidth}px` }}
      >
        {session.DialogComponent ? (
          <Suspense fallback={<div />}>
            <session.DialogComponent
              handleClose={() =>
                session.setDialogComponent(undefined, undefined)
              }
              {...session.DialogProps}
            />
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
          {view.displayName ? (
            <Typography variant="body2" className={classes.displayName}>
              {view.displayName}
            </Typography>
          ) : null}
          <div className={classes.grow} />
          <div style={{ width: 20, height: 20 }}>
            <Logomark variant="white" />
          </div>
        </div>
        <Paper>{children}</Paper>
      </Paper>
    )
  },
)

export default ViewContainer
