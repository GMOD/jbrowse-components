import {
  SvgIconProps,
  IconButton,
  IconButtonProps as IconButtonPropsType,
  Paper,
  makeStyles,
  useTheme,
  Tooltip,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import MenuIcon from '@material-ui/icons/Menu'
import { fade } from '@material-ui/core/styles/colorManipulator'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import React, { useEffect, useRef, useState } from 'react'
import { ContentRect, withContentRect } from 'react-measure'

import { IBaseViewModel } from '../pluggableElementTypes/models'
import EditableTypography from './EditableTypography'
import Menu from './Menu'

const useStyles = makeStyles(theme => ({
  viewContainer: {
    overflow: 'hidden',
    background: theme.palette.secondary.main,
    margin: theme.spacing(0.5),
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
    model: IBaseViewModel
    IconButtonProps: IconButtonPropsType
    IconProps: SvgIconProps
  }) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement>()

    if (!(model.menuItems && model.menuItems.length)) {
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
          onMenuItemClick={(_event, callback) => {
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

export default withContentRect('bounds')(
  observer(
    ({
      view,
      onClose,
      style,
      children,
      contentRect,
      measureRef,
    }: {
      view: IBaseViewModel
      onClose: () => void
      style: React.CSSProperties
      children: React.ReactNode
      contentRect: ContentRect
      measureRef: React.RefObject<HTMLDivElement>
    }) => {
      const classes = useStyles()
      const theme = useTheme()
      const padWidth = theme.spacing(1)

      let width = 0
      if (contentRect.bounds) {
        ;({ width } = contentRect.bounds)
      }
      useEffect(() => {
        if (width) {
          if (isAlive(view)) {
            view.setWidth(width - padWidth * 2)
          }
        }
      }, [padWidth, view, width])

      const scrollRef = useRef<HTMLDivElement>(null)
      // scroll the view into view when first mounted
      // note that this effect will run only once, because of
      // the empty array second param
      useEffect(() => {
        if (scrollRef?.current?.scrollIntoView) {
          scrollRef.current.scrollIntoView({ block: 'center' })
        }
      }, [])

      return (
        <Paper
          elevation={12}
          ref={measureRef}
          className={classes.viewContainer}
          style={{ ...style, padding: `0px ${padWidth}px ${padWidth}px` }}
        >
          <div ref={scrollRef} style={{ display: 'flex' }}>
            <ViewMenu
              model={view}
              IconButtonProps={{
                classes: { root: classes.iconRoot },
                edge: 'start',
              }}
              IconProps={{ className: classes.icon }}
            />
            <div className={classes.grow} />
            <Tooltip title="Rename view" arrow>
              <EditableTypography
                value={
                  view.displayName ||
                  // @ts-ignore
                  (view.assemblyNames
                    ? // @ts-ignore
                      view.assemblyNames.join(',')
                    : 'Untitled view')
                }
                setValue={val => {
                  view.setDisplayName(val)
                }}
                variant="body2"
                classes={{
                  input: classes.input,
                  inputBase: classes.inputBase,
                  inputRoot: classes.inputRoot,
                  inputFocused: classes.inputFocused,
                }}
              />
            </Tooltip>
            <div className={classes.grow} />
            <IconButton
              data-testid="close_view"
              classes={{ root: classes.iconRoot }}
              edge="end"
              onClick={onClose}
            >
              <CloseIcon className={classes.icon} />
            </IconButton>
          </div>
          <Paper>{children}</Paper>
        </Paper>
      )
    },
  ),
)
