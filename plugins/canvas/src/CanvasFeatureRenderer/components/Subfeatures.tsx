import { readConfObject } from '@jbrowse/core/configuration'

import { chooseGlyphComponent, layOut, layOutFeature } from './util'

import type { Glyph } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'
import type { Feature } from '@jbrowse/core/util/simpleFeature'

const transcriptPadding = 10

function drawSubfeatures(props: {
  feature: Feature
  x: number
  y: number
  width: number
  height: number
  selected?: boolean
  ctx: CanvasRenderingContext2D
  config: AnyConfigurationModel
  bpPerPx: number
  region: Region
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
    colorByCDS,
  } = props

  feature.get('subfeatures')?.forEach(subfeature => {
    const subX = x + (subfeature.get('start') - feature.get('start')) / bpPerPx
    const subWidth = (subfeature.get('end') - subfeature.get('start')) / bpPerPx

    const GlyphComponent = chooseGlyphComponent({
      feature: subfeature,
      config,
    })

    if (GlyphComponent && GlyphComponent.draw) {
      GlyphComponent.draw({
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
        colorByCDS,
      })
    }
  })
}

const Subfeatures = {
  draw: drawSubfeatures,
  getHeight: ({
    feature,
    config,
  }: {
    feature: Feature
    config: AnyConfigurationModel
  }) => {
    const displayMode = readConfObject(config, 'displayMode')
    if (displayMode === 'reducedRepresentation') {
      return readConfObject(config, 'height') as number
    } else if (displayMode === 'compact') {
      return (
        (feature.get('subfeatures')?.length || 0) *
        ((readConfObject(config, 'height') as number) / 3)
      )
    } else {
      return (
        (feature.get('subfeatures')?.length || 0) *
        ((readConfObject(config, 'height') as number) + 2)
      )
    }
  },
  layOut: ({
    layout,
    feature,
    bpPerPx,
    reversed,
    config,
  }: {
    layout: SceneGraph
    feature: Feature
    bpPerPx: number
    reversed: boolean
    config: AnyConfigurationModel
  }) => {
    const subLayout = layOutFeature({
      layout,
      feature,
      bpPerPx,
      reversed,
      config,
    })
    const displayMode = readConfObject(config, 'displayMode')
    if (displayMode !== 'reducedRepresentation') {
      let topOffset = 0
      const subfeatures = feature.get('subfeatures')
      if (subfeatures) {
        for (const subfeature of subfeatures) {
          const SubfeatureGlyphComponent = chooseGlyphComponent({
            feature: subfeature,
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
          })
          subSubLayout.move(0, topOffset)
          topOffset +=
            displayMode === 'collapse'
              ? 0
              : (displayMode === 'compact'
                  ? subfeatureHeight / 3
                  : subfeatureHeight) + transcriptPadding
        }
      }
    }
    return subLayout
  },
}

export default Subfeatures
