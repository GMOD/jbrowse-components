import { readConfObject } from '@jbrowse/core/configuration'

import { chooseGlyphComponent } from './util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { Feature } from '@jbrowse/core/util/simpleFeature'

const subfeaturePadding = 2

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
  displayMode: string
}) {
  const {
    feature,
    x,
    y,
    selected,
    ctx,
    config,
    bpPerPx,
    region,
    displayMode,
    colorByCDS,
  } = props

  let currentY = y
  const subfeatures = feature.get('subfeatures')
  if (subfeatures) {
    for (const subfeature_ of subfeatures) {
      const subfeature = subfeature_
      const subX =
        x + (subfeature.get('start') - feature.get('start')) / bpPerPx
      const subWidth =
        (subfeature.get('end') - subfeature.get('start')) / bpPerPx

      const GlyphComponent = chooseGlyphComponent({
        feature: subfeature,
        config,
      })
      const subfeatureHeight = GlyphComponent.getHeight({
        feature: subfeature,
        config,
        displayMode,
      })

      GlyphComponent.draw({
        feature: subfeature,
        x: subX,
        y: currentY,
        width: subWidth,
        height: subfeatureHeight,
        selected,
        ctx,
        config,
        bpPerPx,
        region,
        colorByCDS,
        displayMode,
      })
      currentY += subfeatureHeight + subfeaturePadding
    }
  }
}

const Subfeatures = {
  draw: drawSubfeatures,
  getHeight: ({
    feature,
    config,
    displayMode,
  }: {
    feature: Feature
    config: AnyConfigurationModel
    displayMode: string
  }) => {
    const l = feature.get('subfeatures')?.length || 0
    const h = readConfObject(config, 'height') as number
    if (displayMode === 'reducedRepresentation') {
      return h
    } else if (displayMode === 'compact') {
      return l * (h / 3)
    } else {
      return l * (h + 2)
    }
  },
}

export default Subfeatures
