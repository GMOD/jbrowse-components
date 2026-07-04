import { Suspense } from 'react'

import { getSession, useWidthSetter } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import ViewTitle from './ViewTitle.tsx'

import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'

const useStyles = makeStyles()(theme => ({
  viewContainer: {
    width: '100%',
    // clip (not hidden) so sticky descendant headers keep working
    // xref https://stackoverflow.com/questions/43909940/why-does-overflowhidden-prevent-positionsticky-from-working
    overflow: 'clip',
    background: theme.palette.secondary.main,
    margin: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)} ${theme.spacing(1)}`,
  },
}))

const ViewContainer = observer(function ViewContainer({
  view,
  children,
}: {
  view: IBaseViewModel
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const session = getSession(view)
  const ref = useWidthSetter(view)

  return (
    <Paper elevation={12} ref={ref} className={classes.viewContainer}>
      {session.DialogComponent ? (
        <Suspense fallback={null}>
          <session.DialogComponent {...session.DialogProps} />
        </Suspense>
      ) : null}
      <ViewTitle view={view} />
      <Paper>{children}</Paper>
    </Paper>
  )
})

export default ViewContainer
