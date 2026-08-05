import { DisplayContainer } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import MultiWiggleComponent from './MultiWiggleComponent.tsx'

import type { MultiWiggleDisplayModel } from './multiWiggleDisplayTypes.ts'

// The `ReactComponent` the multi-wiggle display registers: the shared
// `display-${displayId}` container wrapped around the multi-wiggle body. See
// LinearWiggleDisplayComponent for why the pair is registered directly instead
// of reached through the model's old `DisplayMessageComponent` getter.
const MultiLinearWiggleDisplayComponent = observer(
  function MultiLinearWiggleDisplayComponent({
    model,
  }: {
    model: MultiWiggleDisplayModel
  }) {
    return (
      <DisplayContainer model={model}>
        <MultiWiggleComponent model={model} />
      </DisplayContainer>
    )
  },
)

export default MultiLinearWiggleDisplayComponent
