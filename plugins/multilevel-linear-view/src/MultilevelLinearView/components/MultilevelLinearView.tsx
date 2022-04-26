import React from 'react'
import { observer } from 'mobx-react'
import MultilevelLinearComparativeViewComponent from '../../MultilevelLinearComparativeView/components/MultilevelLinearComparativeView'
import { MultilevelLinearViewModel } from '../model'
import ImportForm from './ImportForm'

const MultilevelLinearView = observer(
  ({ model }: { model: MultilevelLinearViewModel }) => {
    const { initialized } = model
    if (!initialized) {
      return <ImportForm model={model} />
    }
    return <MultilevelLinearComparativeViewComponent model={model} />
  },
)

export default MultilevelLinearView
