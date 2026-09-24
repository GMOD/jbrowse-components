import EditableTypography from '@jbrowse/core/ui/EditableTypography'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { viewName, viewTitle } from './viewTitle.ts'

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
  minimized: {
    color: theme.palette.secondary.contrastText,
  },
}))
const ViewContainerTitle = observer(function ViewContainerTitle({
  view,
}: {
  view: IBaseViewModel
}) {
  const { classes } = useStyles()
  const { assemblyManager } = getSession(view)
  const getDisplayName = (r: string) => assemblyManager.getDisplayName(r)
  return (
    <>
      <Tooltip
        title={`${viewTitle(view, getDisplayName)} (click to rename)`}
        arrow
      >
        <EditableTypography
          value={viewName(view, getDisplayName)}
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
      {view.minimized ? (
        <Typography variant="body2" className={classes.minimized}>
          (minimized)
        </Typography>
      ) : null}
    </>
  )
})

export default ViewContainerTitle
