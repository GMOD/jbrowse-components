import { readConfObject } from '@jbrowse/core/configuration'

import { chooseGlyphComponent } from './util'

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
  
}

export default Subfeatures
