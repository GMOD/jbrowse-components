import React from 'react'
import { Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// locals
import EditableTypography from '@jbrowse/core/ui/EditableTypography'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes'

const useStyles = makeStyles()(theme => ({
  input: {
    paddingBottom: 0,
    paddingTop: 2,
  },
  inputBase: {
    color: theme.palette.secondary.contrastText,
  },
  inputFocused: {
    backgroundColor: theme.palette.secondary.light,
    borderColor: theme.palette.primary.main,
  },
  inputRoot: {
    '&:hover': {
      backgroundColor: theme.palette.secondary.light,
    },
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
        setValue={val => view.setDisplayName(val)}
        variant="body2"
        classes={{
          input: classes.input,
          inputBase: classes.inputBase,
          inputFocused: classes.inputFocused,
          inputRoot: classes.inputRoot,
        }}
      />
    </Tooltip>
  )
})

export default ViewContainerTitle
