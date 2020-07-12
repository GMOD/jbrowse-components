import { IBaseViewModel } from '@gmod/jbrowse-core/BaseViewModel'
import { Menu } from '@gmod/jbrowse-core/ui'
import IconButton, {
  IconButtonProps as IconButtonPropsType,
} from '@material-ui/core/IconButton'
import Paper from '@material-ui/core/Paper'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import { SvgIconProps } from '@material-ui/core/SvgIcon'
import Typography from '@material-ui/core/Typography'
import MenuIcon from '@material-ui/icons/Menu'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import useDimensions from 'react-use-dimensions'

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

    if (!(model.menuOptions && model.menuOptions.length)) {
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
          menuOptions={model.menuOptions}
        />
      </>
    )
  },
)

function ViewContainer({
  view,
  children,
}: {
  view: IBaseViewModel
  children: React.ReactNode
}) {
  const classes = useStyles()
  const theme = useTheme()
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
      <div style={{ display: 'flex' }}>
        <ViewMenu
          model={view}
          IconButtonProps={{
            classes: { root: classes.iconRoot },
            size: 'small',
            edge: 'start',
          }}
          IconProps={{ fontSize: 'small', className: classes.icon }}
        />
        <div className={classes.grow} />
        {view.displayName ? (
          <Typography variant="body2" className={classes.displayName}>
            {view.displayName}
          </Typography>
        ) : null}
        <div className={classes.grow} />
      </div>
      <Paper>{children}</Paper>
    </Paper>
  )
}

export default observer(ViewContainer)
