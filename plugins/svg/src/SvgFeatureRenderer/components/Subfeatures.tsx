import React from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'
import { chooseGlyphComponent, layOut, layOutFeature } from './util'
import type { ExtraGlyphValidator } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { SceneGraph } from '@jbrowse/core/util/layouts'
import type { Feature } from '@jbrowse/core/util/simpleFeature'

const Subfeatures = observer(function Subfeatures(props: {
  feature: Feature
  featureLayout: SceneGraph
  selected?: boolean
}) {
  const { feature, featureLayout, selected } = props

  return feature.get('subfeatures')?.map(subfeature => {
    const subfeatureId = String(subfeature.id())
    const subfeatureLayout = featureLayout.getSubRecord(subfeatureId)
    if (!subfeatureLayout) {
      return null
    }
    const { GlyphComponent } = subfeatureLayout.data || {}
    return (
      <GlyphComponent
        key={`glyph-${subfeatureId}`}
        {...props}
        feature={subfeature}
        featureLayout={subfeatureLayout}
        selected={selected}
      />
    )
  })
})

// @ts-expect-error
Subfeatures.layOut = ({
  layout,
  feature,
  bpPerPx,
  reversed,
  config,
  extraGlyphs,
}: {
  layout: SceneGraph
  feature: Feature
  bpPerPx: number
  reversed: boolean
  config: AnyConfigurationModel
  extraGlyphs: ExtraGlyphValidator[]
}) => {
  const subLayout = layOutFeature({
    layout,
    feature,
    bpPerPx,
    reversed,
    config,
    extraGlyphs,
  })
  const displayMode = readConfObject(config, 'displayMode')
  if (displayMode !== 'reducedRepresentation') {
    let topOffset = 0
    feature.get('subfeatures')?.forEach(subfeature => {
      const SubfeatureGlyphComponent = chooseGlyphComponent({
        feature: subfeature,
        extraGlyphs,
        config,
      })
      const subfeatureHeight = readConfObject(config, 'height', {
        feature: subfeature,
      }) as number

      const subSubLayout = (SubfeatureGlyphComponent.layOut || layOut)({
        layout: subLayout,
        feature: subfeature,
        bpPerPx,
        reversed,
        config,
        extraGlyphs,
      })
      subSubLayout.move(0, topOffset)
      topOffset +=
        displayMode === 'collapse'
          ? 0
          : (displayMode === 'compact'
              ? subfeatureHeight / 3
              : subfeatureHeight) + 2
    })
  }
  return subLayout
}

export default Subfeatures
