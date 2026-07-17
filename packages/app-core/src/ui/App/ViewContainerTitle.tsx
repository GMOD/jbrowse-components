import EditableTypography from '@jbrowse/core/ui/EditableTypography'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { viewTitle } from './viewTitle.ts'

import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes'

const useStyles = makeStyles()(theme => ({
  input: {
    paddingBottom: 0,
    paddingTop: 2,
    // long view titles (e.g. a read-vs-ref panel named after a long PacBio
    // QNAME) truncate with an ellipsis instead of overflowing the header
    maxWidth: 300,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
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
const ViewContainerTitle = observer(function ViewContainerTitle({
  view,
}: {
  view: IBaseViewModel
}) {
  const { classes } = useStyles()
  const { assemblyManager } = getSession(view)
  const title = viewTitle(view, r => assemblyManager.getDisplayName(r))
  return (
    <Tooltip title={`${title} (click to rename)`} arrow>
      <EditableTypography
        value={title}
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
