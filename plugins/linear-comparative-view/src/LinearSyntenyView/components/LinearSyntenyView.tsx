import { lazy } from 'react'

import { ViewLoadingScreen } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { MultiLevelRubberband } from '@jbrowse/plugin-linear-genome-view'
import { DiagonalizeLoadingScreen } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import Header from './Header.tsx'
import LinearSyntenyRenderArea from './LinearSyntenyRenderArea.tsx'

import type { LinearSyntenyViewModel } from '../model.ts'

const LinearSyntenyImportForm = lazy(
  () => import('./ImportForm/LinearSyntenyImportForm.tsx'),
)

const useStyles = makeStyles()(theme => ({
  // this helps keep the vertical guide inside the parent view container,
  // similar style exists in the single LGV's trackscontainer
  rubberbandContainer: {
    position: 'relative',
    overflow: 'hidden',
  },

  rubberbandDiv: {
    width: '100%',
    background: theme.palette.action.disabledBackground,
    height: 15,
    '&:hover': {
      background: theme.palette.action.selected,
    },
  },
}))

const SyntenyRows = observer(function SyntenyRows({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { classes } = useStyles()

  return (
    <div className={classes.rubberbandContainer}>
      <Header model={model} />
      <MultiLevelRubberband
        model={model}
        ControlComponent={<div className={classes.rubberbandDiv} />}
      />
      <LinearSyntenyRenderArea model={model} />
    </div>
  )
})

const LinearSyntenyView = observer(function LinearSyntenyView({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { loading, showImportForm, awaitingAutoDiagonalize } = model

  if (awaitingAutoDiagonalize) {
    return (
      <DiagonalizeLoadingScreen
        status={model.diagonalizeStatus}
        onCancel={() => {
          model.cancelAutoDiagonalize()
        }}
      />
    )
  } else if (loading) {
    return <ViewLoadingScreen {...loading} />
  } else if (showImportForm) {
    return <LinearSyntenyImportForm model={model} />
  } else {
    return <SyntenyRows model={model} />
  }
})

export default LinearSyntenyView
