import React from 'react'
import { observer } from 'mobx-react'
import { IconButton } from '@mui/material'
import LinearComparativeViewComponent from '../../LinearComparativeView/components/LinearComparativeView'
import { LinearSyntenyViewModel } from '../model'
import { Curves, StraightLines } from './Icons'
import ImportForm from './ImportForm'

type LSV = LinearSyntenyViewModel

const ExtraButtons = observer(({ model }: { model: LSV }) => {
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
})

const LinearSyntenyView = observer(({ model }: { model: LSV }) => {
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
})

export default LinearSyntenyView
