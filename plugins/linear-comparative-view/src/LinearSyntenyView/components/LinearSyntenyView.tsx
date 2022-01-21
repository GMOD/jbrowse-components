import React from 'react'
import { observer } from 'mobx-react'
import { Button } from '@material-ui/core'
import LinearComparativeViewComponent from '../../LinearComparativeView/components/LinearComparativeView'
import { LinearSyntenyViewModel } from '../model'
import ImportForm from './ImportForm'

const ExtraButtons = observer(
  ({ model }: { model: LinearSyntenyViewModel }) => {
    return (
      <Button
        onClick={() => {
          model.toggleCurves()
        }}
      >
        Curves
      </Button>
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
