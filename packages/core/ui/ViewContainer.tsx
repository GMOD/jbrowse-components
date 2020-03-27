import Icon, { IconProps as IP } from '@material-ui/core/Icon'
import IconButton, {
  IconButtonProps as IBP,
} from '@material-ui/core/IconButton'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Tooltip from '@material-ui/core/Tooltip'
import { observer } from 'mobx-react'
import React, { useEffect, useRef, useState } from 'react'
import EditableTypography from './EditableTypography'
import Menu, { MenuOptions } from './Menu'

const useStyles = makeStyles(theme => ({
  viewContainer: {
    overflow: 'hidden',
    background: theme.palette.secondary.main,
  },
  icon: {
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
  listItemIconRoot: {
    minWidth: 28,
  },
  listItemInset: {
    paddingLeft: 28,
  },
  menuItemDense: {
    paddingLeft: theme.spacing(1),
    paddingRight: 26,
    paddingTop: 0,
    paddingBottom: 0,
  },
  secondaryActionRoot: {
    right: theme.spacing(1),
  },
  input: {
    paddingBottom: 0,
    paddingTop: 2,
  },
  inputBase: {
    color: theme.palette.secondary.contrastText,
  },
  inputRoot: {
    '&:hover': {
      backgroundColor: theme.palette.secondary.light,
    },
  },
  inputFocused: {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.secondary.light,
  },
}))

const ViewMenu = observer(
  ({
    model,
    IconButtonProps,
    IconProps,
  }: {
    model: { menuOptions: MenuOptions[] }
    IconButtonProps: IBP
    IconProps: IP
  }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

    function handleClick(event: React.MouseEvent<HTMLElement>) {
      setAnchorEl(event.currentTarget)
    }

    const handleMenuItemClick = (
      event: React.MouseEvent<HTMLLIElement, MouseEvent>,
      callback: () => void,
    ) => {
      callback()
      setAnchorEl(null)
    }

    function handleClose() {
      setAnchorEl(null)
    }

    if (!model.menuOptions) {
      return null
    }

    return (
      <>
        <IconButton
          {...IconButtonProps}
          aria-label="more"
          aria-controls="view-menu"
          aria-haspopup="true"
          onClick={handleClick}
        >
          <Icon {...IconProps}>menu</Icon>
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onMenuItemClick={handleMenuItemClick}
          onClose={handleClose}
          menuOptions={model.menuOptions}
        />
      </>
    )
  },
)

export default observer(
  ({
    view,
    onClose,
    style,
    children,
  }: {
    view: {
      menuOptions: MenuOptions[]
      displayName: string
      setDisplayName: (displayName: string) => void
    }
    onClose: () => void
    style: React.CSSProperties
    children: React.ReactNode
  }) => {
    const classes = useStyles()
    const containerNodeRef = useRef<HTMLElement>(null)

    // scroll the view into view when first mounted
    // note that this effect will run only once, because of
    // the empty array second param
    useEffect(() => {
      if (
        containerNodeRef &&
        containerNodeRef.current &&
        containerNodeRef.current.scrollIntoView
      )
        containerNodeRef.current.scrollIntoView({ block: 'center' })
    }, [])

    return (
      <Paper
        elevation={12}
        ref={containerNodeRef}
        className={classes.viewContainer}
        style={style}
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
            <Tooltip title="Rename View" arrow>
              <EditableTypography
                value={view.displayName}
                setValue={view.setDisplayName}
                variant="body2"
                classes={{
                  input: classes.input,
                  inputBase: classes.inputBase,
                  inputRoot: classes.inputRoot,
                  inputFocused: classes.inputFocused,
                }}
              />
            </Tooltip>
          ) : null}
          <div className={classes.grow} />
          <IconButton
            classes={{ root: classes.iconRoot }}
            size="small"
            edge="end"
            onClick={onClose}
          >
            <Icon fontSize="small" className={classes.icon}>
              close
            </Icon>
          </IconButton>
        </div>
        <Paper>{children}</Paper>
      </Paper>
    )
  },
)
