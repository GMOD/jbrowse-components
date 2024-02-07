import React from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

// icons
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'

// locals
import ViewContainerTitle from './ViewContainerTitle'
import { getSession } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  icon: {
    color: theme.palette.secondary.contrastText,
  },
  grow: {
    flexGrow: 1,
  },
  viewHeader: {
    display: 'flex',
  },
  viewTitle: {
    display: 'flex',
    alignItems: 'center',
  },
}))

const ViewTitle = observer(function ({ view }: { view: IBaseViewModel }) {
  const { classes } = useStyles()
  const session = getSession(view)
  return (
    <div className={classes.viewTitle}>
      {session.focusedViewId === view.id ? (
        <KeyboardArrowRightIcon className={classes.icon} fontSize="small" />
      ) : null}
      <ViewContainerTitle view={view} />
    </div>
  )
})

export default ViewTitle
