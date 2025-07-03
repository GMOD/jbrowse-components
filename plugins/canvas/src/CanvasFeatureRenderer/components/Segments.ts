import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { stripAlpha } from '@jbrowse/core/util'

import Arrow from './Arrow'
import { chooseGlyphComponent } from './util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

function drawSegments(props: {
  region: Region
  feature: Feature
  x: number
  y: number
  width: number
  height: number
  config: AnyConfigurationModel
  selected?: boolean
  subfeatures?: Feature[]
  ctx: CanvasRenderingContext2D
  bpPerPx: number
  colorByCDS: boolean
  displayMode: string
}) {
  const {
    feature,
    x,
    y,
    region,
    width,
    height,
    selected,
    config,
    ctx,
    bpPerPx,
    colorByCDS,
    displayMode,
    // some subfeatures may be computed e.g. makeUTRs,
    // so these are passed as a prop, or feature.get('subfeatures') by default
    subfeatures = feature.get('subfeatures'),
  } = props

  const theme = createJBrowseTheme()
  const c = readConfObject(config, 'color2', { feature })
  const color2 = c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c

  const segmentY = y + height / 2

  ctx.strokeStyle = color2
  ctx.beginPath()
  ctx.moveTo(x, segmentY)
  ctx.lineTo(x + width, segmentY)
  ctx.stroke()

  if (subfeatures) {
    for (const subfeature of subfeatures) {
      const subfeatureLayout = feature.get('subfeatures')
        ? feature.get('subfeatures')!.find(f => f.id() === subfeature.id())
        : undefined

      if (!subfeatureLayout) {
        continue
      }

      const subX =
        x + (subfeature.get('start') - feature.get('start')) / bpPerPx
      const subWidth =
        (subfeature.get('end') - subfeature.get('start')) / bpPerPx

      const GlyphComponent = chooseGlyphComponent({
        feature: subfeature,
        config,
      })
      if (GlyphComponent && GlyphComponent.draw) {
        GlyphComponent.draw({
          ...props,
          feature: subfeature,
          topLevel: false,
          x: subX,
          y,
          width: subWidth,
          height,
          selected,
          ctx,
          bpPerPx,
          colorByCDS,
          displayMode,
        })
      }
    }
  }

  Arrow.draw({
    feature,
    x,
    y,
    width,
    height,
    config,
    region,
    ctx,
  })
}

const Segments = {
  draw: drawSegments,
  getHeight: ({
    config,
    displayMode,
  }: {
    config: AnyConfigurationModel
    displayMode: string
  }) => {
    const height = readConfObject(config, 'height') as number
    return displayMode === 'compact' ? height / 3 : height
  },
}

export default Segments
