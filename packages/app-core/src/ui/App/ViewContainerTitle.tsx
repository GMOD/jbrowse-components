import React from 'react'
import { Tooltip, darken } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// locals
import EditableTypography from '@jbrowse/core/ui/EditableTypography'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes'
import {
  SessionWithFocusedViewAndDrawerWidgets,
  getSession,
} from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  input: {
    color: theme.palette.secondary.contrastText,
  },
  inputDarkened: {
    color: darken(theme.palette.secondary.contrastText, 0.4),
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
export default observer(function ViewContainerTitle({
  view,
}: {
  view: IBaseViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(view) as SessionWithFocusedViewAndDrawerWidgets
  const inputClass =
    session.focusedViewId === view.id ? classes.input : classes.inputDarkened
  return (
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
          input: inputClass,
          inputBase: classes.inputBase,
          inputRoot: classes.inputRoot,
          inputFocused: classes.inputFocused,
        }}
      />
    </Tooltip>
  )
})
