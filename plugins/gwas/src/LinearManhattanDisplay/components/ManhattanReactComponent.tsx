import { DisplayContainer } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import LinearManhattanDisplayComponent from './LinearManhattanDisplayComponent.tsx'

import type { ManhattanDisplayModel } from './manhattanDisplayTypes.ts'

// The `ReactComponent` the manhattan display registers: the shared
// `display-${displayId}` container wrapped around the manhattan body. Composed
// here rather than reached through the model's old `DisplayMessageComponent`
// getter, which made the model hold a lazy import of its own React component —
// see plugin-wiggle's LinearWiggleDisplayComponent for the full reasoning. The
// emitted DOM is unchanged: this container's `display-${id}-done` plus
// DisplayChrome's `manhattan-display-done`.
const ManhattanReactComponent = observer(function ManhattanReactComponent({
  model,
}: {
  model: ManhattanDisplayModel
}) {
  return (
    <DisplayContainer model={model}>
      <LinearManhattanDisplayComponent model={model} />
    </DisplayContainer>
  )
})

export default ManhattanReactComponent
