import {
  DisplayContainer,
  FloatingLegend,
} from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import FeatureComponent from './FeatureComponent.tsx'

import type { LinearCanvasBaseDisplayModel } from '../baseModel.ts'

// The `ReactComponent` every canvas-family display registers — the feature
// display and the variant display share this one, so no plugin imports another
// plugin's component and there's only one lazy chunk boundary for the canvas body.
//
// It is composed here rather than reached through a `DisplayMessageComponent`
// getter on the model: that getter forced the model to `lazy()`-import the
// component, and the resulting model↔component cycle is why FeatureComponent used
// to hand-mirror its model type in a 92-field structural interface. Per-display
// chrome comes from model hooks on the canvas base (`colorLegend` here,
// `geneGlyphNotice` in the body), which is what lets one component serve both.
const LinearBasicDisplayComponent = observer(
  function LinearBasicDisplayComponent({
    model,
  }: {
    model: LinearCanvasBaseDisplayModel
  }) {
    return (
      <DisplayContainer model={model}>
        <FeatureComponent model={model} />
        <ColorLegendOverlay model={model} />
      </DisplayContainer>
    )
  },
)

// Sits in the container (not inside DisplayChrome) so it keeps its position over
// the canvas the way it did when the variant display rendered it as a wrapper
// child. Its own observer so a coloring change repaints the key alone.
const ColorLegendOverlay = observer(function ColorLegendOverlay({
  model,
}: {
  model: LinearCanvasBaseDisplayModel
}) {
  const legend = model.colorLegend
  return legend ? (
    <FloatingLegend
      items={legend.items}
      onDismiss={() => {
        legend.dismiss()
      }}
    />
  ) : null
})

export default LinearBasicDisplayComponent
