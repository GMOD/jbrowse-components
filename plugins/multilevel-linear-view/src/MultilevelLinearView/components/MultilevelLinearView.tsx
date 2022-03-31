import React from 'react'
import { observer } from 'mobx-react'
import { IconButton } from '@material-ui/core'
import MultilevelLinearComparativeViewComponent from '../../MultilevelLinearComparativeView/components/MultilevelLinearComparativeView'
import { MultilevelLinearViewModel } from '../model'
import { Curves, StraightLines } from './Icons'
import ImportForm from './ImportForm'

// const ExtraButtons = observer(
//   ({ model }: { model: MultilevelLinearViewModel }) => {
//     return (
//       <IconButton
//         onClick={() => {
//           model.toggleCurves()
//         }}
//         title="Toggle drawing straight or curved multilevel lines"
//       >
//         {model.drawCurves ? (
//           <StraightLines color="secondary" />
//         ) : (
//           <Curves color="secondary" />
//         )}
//       </IconButton>
//     )
//   },
// )

const MultilevelLinearView = observer(
  ({ model }: { model: MultilevelLinearViewModel }) => {
    const { initialized } = model
    if (!initialized) {
      return <ImportForm model={model} />
    }
    return (
      <MultilevelLinearComparativeViewComponent
        model={model}
        // ExtraButtons={<ExtraButtons model={model} />}
      />
    )
  },
)

export default MultilevelLinearView
