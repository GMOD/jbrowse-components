import Icon, { IconProps as IP } from '@material-ui/core/Icon'
import IconButton, {
  IconButtonProps as IBP,
} from '@material-ui/core/IconButton'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction'
import ListItemText from '@material-ui/core/ListItemText'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Tooltip from '@material-ui/core/Tooltip'
import { observer } from 'mobx-react'
import React, { useEffect, useRef, useState } from 'react'
import EditableTypography from './EditableTypography'

export interface MenuOption {
  title: string
  key: string
  icon?: string
  callback: Function
  checked?: boolean
  isCheckbox: boolean
  disabled?: boolean
}

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
    model: { menuOptions: MenuOption[] }
    IconButtonProps: IBP
    IconProps: IP
  }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
    const classes = useStyles()
    const open = Boolean(anchorEl)

    function handleClick(event: React.MouseEvent<HTMLElement>) {
      setAnchorEl(event.currentTarget)
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
          id="view-menu"
          anchorEl={anchorEl}
          keepMounted
          open={open}
          onClose={handleClose}
        >
          {model.menuOptions.map(option => {
            return (
              <MenuItem
                key={option.key}
                dense
                disableGutters
                onClick={() => {
                  option.callback()
                  handleClose()
                }}
                classes={{ dense: classes.menuItemDense }}
              >
                {option.icon ? (
                  <ListItemIcon classes={{ root: classes.listItemIconRoot }}>
                    <Icon fontSize="small">{option.icon}</Icon>
                  </ListItemIcon>
                ) : null}
                <ListItemText
                  primary={option.title}
                  inset={!option.icon}
                  classes={{ inset: classes.listItemInset }}
                />
                {option.isCheckbox ? (
                  <ListItemSecondaryAction
                    classes={{ root: classes.secondaryActionRoot }}
                  >
                    <IconButton
                      disabled
                      size="small"
                      edge="end"
                      aria-label="delete"
                    >
                      <Icon
                        fontSize="small"
                        color={option.checked ? 'secondary' : 'inherit'}
                      >
                        {option.checked
                          ? 'check_box'
                          : 'check_box_outline_blank'}
                      </Icon>
                    </IconButton>
                  </ListItemSecondaryAction>
                ) : null}
              </MenuItem>
            )
          })}
        </Menu>
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
      menuOptions: MenuOption[]
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
