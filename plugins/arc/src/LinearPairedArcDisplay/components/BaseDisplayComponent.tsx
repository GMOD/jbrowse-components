import React from 'react'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { BlockMsg } from '@jbrowse/plugin-linear-genome-view'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// local
import { LinearArcDisplayModel } from '../model'

const useStyles = makeStyles()(theme => ({
  loading: {
    backgroundColor: theme.palette.background.default,
    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${theme.palette.action.disabledBackground} 5px, ${theme.palette.action.disabledBackground} 10px)`,
    position: 'absolute',
    bottom: 0,
    height: 50,
    width: 300,
    right: 0,
    pointerEvents: 'none',
    textAlign: 'center',
  },
}))

const BaseDisplayComponent = observer(function ({
  model,
  children,
}: {
  model: LinearArcDisplayModel
  children?: React.ReactNode
}) {
  const { error, regionTooLarge } = model
  return error ? (
    <BlockMsg
      message={`${error}`}
      severity="error"
      buttonText="Reload"
      action={model.reload}
    />
  ) : regionTooLarge ? (
    model.regionCannotBeRendered()
  ) : (
    <DataDisplay model={model}>{children}</DataDisplay>
  )
})

const DataDisplay = observer(function ({
  model,
  children,
}: {
  model: LinearArcDisplayModel
  children?: React.ReactNode
}) {
  const { loading } = model
  return (
    <div>
      {children}
      {loading ? <LoadingBar model={model} /> : null}
    </div>
  )
})

const LoadingBar = observer(function ({
  model,
}: {
  model: LinearArcDisplayModel
}) {
  const { classes } = useStyles()
  const { message } = model
  return (
    <div className={classes.loading}>
      <LoadingEllipses message={message} />
    </div>
  )
})

export default BaseDisplayComponent
