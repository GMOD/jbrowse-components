import React from 'react'
import { observer } from 'mobx-react'
import LinearComparativeViewComponent from '../../LinearComparativeView/components/LinearComparativeView'
import { LinearSyntenyViewModel } from '../model'
import ImportForm from './ImportForm'

const LinearSyntenyView = observer(
  ({ model }: { model: LinearSyntenyViewModel }) => {
    const { initialized, loading } = model
    if (!initialized && !loading) {
      return <ImportForm model={model} />
    }
    return <LinearComparativeViewComponent model={model} />
  },
)

export default LinearSyntenyView
