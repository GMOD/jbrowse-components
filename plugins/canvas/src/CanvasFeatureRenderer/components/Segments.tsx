import { readConfObject } from '@jbrowse/core/configuration'
import { stripAlpha } from '@jbrowse/core/util'
import { createJBrowseTheme } from '@jbrowse/core/ui'

import { drawArrow } from './Arrow'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'
import type { Glyph } from './util'

function drawSegments(props: {
  region: Region
  feature: Feature
  // Removed featureLayout: SceneGraph
  x: number
  y: number
  width: number
  height: number
  config: AnyConfigurationModel
  selected?: boolean
  reversed: boolean
  subfeatures?: Feature[]
  ctx: CanvasRenderingContext2D
  bpPerPx: number
  colorByCDS: boolean
}) {
  const {
    feature,
    // Removed featureLayout
    x,
    y,
    width,
    height,
    selected,
    config,
    ctx,
    bpPerPx,
    colorByCDS,
    reversed,
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

  subfeatures?.forEach(subfeature => {
    const subfeatureLayout = feature.get('subfeatures')
      ? (feature.get('subfeatures') as Feature[]).find(
          f => f.id() === subfeature.id(),
        )
      : undefined

    if (!subfeatureLayout) {
      return
    }

    const subX = x + (subfeature.get('start') - feature.get('start')) / bpPerPx
    const subWidth = (subfeature.get('end') - subfeature.get('start')) / bpPerPx

    const { GlyphComponent } = subfeatureLayout.data || {}
    if (GlyphComponent && (GlyphComponent as Glyph).draw) {
      ;(GlyphComponent as Glyph).draw({
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
        reversed,
      })
    }
  })

  drawArrow({
    feature,
    x,
    y,
    width,
    height,
    config,
    region,
    ctx,
    reversed,
  })
}

const Segments = {
  draw: drawSegments,
}

export default Segments
