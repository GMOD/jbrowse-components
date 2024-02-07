import React from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'

// locals
import ViewMenu from './ViewMenu'
import ViewHeaderButtons from './ViewHeaderButtons'
import ViewTitle from './ViewTitle'

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
}))

const ViewHeader = observer(function ({
  view,
  onClose,
  onMinimize,
}: {
  view: IBaseViewModel
  onClose: () => void
  onMinimize: () => void
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.viewHeader}>
      <ViewMenu model={view} IconProps={{ className: classes.icon }} />
      <div className={classes.grow} />
      <ViewTitle view={view} />
      <div className={classes.grow} />
      <ViewHeaderButtons
        onClose={onClose}
        onMinimize={onMinimize}
        view={view}
      />
    </div>
  )
})

export default ViewHeader
