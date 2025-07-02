import { readConfObject } from '@jbrowse/core/configuration'

import { chooseGlyphComponent, layOut, layOutFeature } from './util'

import type { ExtraGlyphValidator } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { SceneGraph } from '@jbrowse/core/util/layouts'
import type { Feature } from '@jbrowse/core/util/simpleFeature'
import type { Glyph } from './util'

function drawSubfeatures(props: {
  feature: Feature
  // Removed featureLayout: SceneGraph
  x: number
  y: number
  width: number
  height: number
  selected?: boolean
  ctx: CanvasRenderingContext2D
  config: AnyConfigurationModel
  bpPerPx: number
  region: any // Region type
  reversed: boolean
  extraGlyphs?: ExtraGlyphValidator[]
  colorByCDS: boolean
}) {
  const {
    feature,
    x,
    y,
    width,
    height,
    selected,
    ctx,
    config,
    bpPerPx,
    region,
    reversed,
    extraGlyphs,
    colorByCDS,
  } = props

  feature.get('subfeatures')?.forEach(subfeature => {
    const subX = x + (subfeature.get('start') - feature.get('start')) / bpPerPx
    const subWidth = (subfeature.get('end') - subfeature.get('start')) / bpPerPx

    const GlyphComponent = chooseGlyphComponent({
      feature: subfeature,
      extraGlyphs,
      config,
    })

    if (GlyphComponent && (GlyphComponent as Glyph).draw) {
      ;(GlyphComponent as Glyph).draw({
        feature: subfeature,
        x: subX,
        y,
        width: subWidth,
        height,
        selected,
        ctx,
        config,
        bpPerPx,
        region,
        reversed,
        colorByCDS,
      })
    }
  })
}

const Subfeatures = {
  draw: drawSubfeatures,
  layOut: ({
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
      const subfeatures = feature.get('subfeatures')
      if (subfeatures) {
        for (const subfeature of subfeatures) {
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
        }
      }
    }
    return subLayout
  },
}

export default Subfeatures
