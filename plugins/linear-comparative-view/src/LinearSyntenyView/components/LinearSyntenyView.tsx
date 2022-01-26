import React from 'react'
import { observer } from 'mobx-react'
import { IconButton } from '@material-ui/core'
import LinearComparativeViewComponent from '../../LinearComparativeView/components/LinearComparativeView'
import { LinearSyntenyViewModel } from '../model'
import { Curves, StraightLines } from './Icons'
import ImportForm from './ImportForm'

const ExtraButtons = observer(
  ({ model }: { model: LinearSyntenyViewModel }) => {
    return (
      <IconButton
        onClick={() => {
          model.toggleCurves()
        }}
        title="Toggle drawing straight or curved synteny lines"
      >
        {model.drawCurves ? (
          <StraightLines color="secondary" />
        ) : (
          <Curves color="secondary" />
        )}
      </IconButton>
    )
  },
)

const LinearSyntenyView = observer(
  ({ model }: { model: LinearSyntenyViewModel }) => {
    const { initialized } = model
    if (!initialized) {
      return <ImportForm model={model} />
    }
    return (
      <LinearComparativeViewComponent
        model={model}
        ExtraButtons={<ExtraButtons model={model} />}
      />
    )
  },
)

export default LinearSyntenyView
