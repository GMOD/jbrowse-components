import { DisplayContainer } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import WiggleComponent from './WiggleComponent.tsx'

import type { WiggleDisplayModel } from './wiggleDisplayTypes.ts'

// The `ReactComponent` the wiggle display registers: the shared
// `display-${displayId}` container wrapped around the wiggle body.
//
// Composed here rather than reached through the model's
// `DisplayMessageComponent` getter, which is how this used to work. That getter
// made the *model* hold a lazy import of a React component — a model↔component
// cycle for no gain, since a display already names its component at
// registration. Registering the pair directly leaves the model with no view of
// its own UI, and puts the container next to the body it wraps instead of two
// modules apart. Same shape the canvas family uses
// (`LinearBasicDisplayComponent`), and the emitted DOM is unchanged: this
// container's `display-${id}-done` plus DisplayChrome's `wiggle-display-done`,
// both of which browser tests key on.
//
// Note the GC-content displays register the *inner* `WiggleComponent` instead
// (see plugins/gccontent), so they draw the same body with no container — which
// is why the container lives here and not inside WiggleComponent.
const LinearWiggleDisplayComponent = observer(
  function LinearWiggleDisplayComponent({
    model,
  }: {
    model: WiggleDisplayModel
  }) {
    return (
      <DisplayContainer model={model}>
        <WiggleComponent model={model} />
      </DisplayContainer>
    )
  },
)

export default LinearWiggleDisplayComponent
