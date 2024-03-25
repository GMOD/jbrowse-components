import React, { Suspense } from 'react'
import { Paper, ScopedCssBaseline, useTheme } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { getSession, useWidthSetter } from '@jbrowse/core/util'
import ViewTitle from './ViewTitle'

const useStyles = makeStyles()(theme => ({
  // avoid parent styles getting into this div
  // https://css-tricks.com/almanac/properties/a/all/
  avoidParentStyle: {
    all: 'initial',
  },
  viewContainer: {
    overflow: 'hidden',
    background: theme.palette.secondary.main,
    margin: theme.spacing(0.5),
    padding: `0 ${theme.spacing(1)} ${theme.spacing(1)}`,
  },
}))

const ViewContainer = observer(function ({
  view,
  children,
}: {
  view: IBaseViewModel
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const session = getSession(view)
  const theme = useTheme()
  const ref = useWidthSetter(view, theme.spacing(1))

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

const ViewContainerWrapper = observer(function ({
  view,
  children,
}: {
  view: IBaseViewModel
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.avoidParentStyle}>
      <ScopedCssBaseline>
        <ViewContainer view={view}>{children}</ViewContainer>
      </ScopedCssBaseline>
    </div>
  )
})
export default ViewContainerWrapper
