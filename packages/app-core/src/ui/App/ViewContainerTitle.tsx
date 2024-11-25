import React from 'react'
import EditableTypography from '@jbrowse/core/ui/EditableTypography'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes'

const useStyles = makeStyles()(theme => ({
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
const ViewContainerTitle = observer(function ({
  view,
}: {
  view: IBaseViewModel
}) {
  const { classes } = useStyles()
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
  )
})

export default ViewContainerTitle
