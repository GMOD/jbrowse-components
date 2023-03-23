import React, { useEffect, useRef } from 'react'
import { IconButton, Paper, Tooltip, useTheme } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// icons
import CloseIcon from '@mui/icons-material/Close'
import MinimizeIcon from '@mui/icons-material/Minimize'
import AddIcon from '@mui/icons-material/Add'

// locals
import { IBaseViewModel } from '../pluggableElementTypes/models'
import EditableTypography from './EditableTypography'
import ViewMenu from './ViewMenu'
import { useWidthSetter } from '../util'

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
  grow: {
    flexGrow: 1,
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

export default observer(function ({
  view,
  onClose,
  onMinimize,
  children,
}: {
  view: IBaseViewModel
  onClose: () => void
  onMinimize: () => void
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const theme = useTheme()
  const ref = useWidthSetter(view, theme.spacing(1))
  const scrollRef = useRef<HTMLDivElement>(null)

  // scroll the view into view when first mounted
  // note that this effect will run only once, because of
  // the empty array second param
  useEffect(() => {
    scrollRef.current?.scrollIntoView?.({ block: 'center' })
  }, [])

  return (
    <Paper ref={ref} elevation={12} className={classes.viewContainer}>
      <div ref={scrollRef} style={{ display: 'flex' }}>
        <ViewMenu model={view} IconProps={{ className: classes.icon }} />
        <div className={classes.grow} />
        <Tooltip title="Rename view" arrow>
          <EditableTypography
            value={
              view.displayName ||
              // @ts-expect-error
              `${view.assemblyNames?.join(',') || 'Untitled view'}${
                view.minimized ? ' (minimized)' : ''
              }`
            }
            setValue={val => view.setDisplayName(val)}
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
        <IconButton data-testid="minimize_view" onClick={onMinimize}>
          {view.minimized ? (
            <AddIcon className={classes.icon} fontSize="small" />
          ) : (
            <MinimizeIcon className={classes.icon} fontSize="small" />
          )}
        </IconButton>
        <IconButton data-testid="close_view" onClick={onClose}>
          <CloseIcon className={classes.icon} fontSize="small" />
        </IconButton>
      </div>
      <Paper>{children}</Paper>
    </Paper>
  )
})
