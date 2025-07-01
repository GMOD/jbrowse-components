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
  featureLayout: SceneGraph
  config: AnyConfigurationModel
  selected?: boolean
  reversed?: boolean
  subfeatures?: Feature[]
  ctx: CanvasRenderingContext2D
  bpPerPx: number
  colorByCDS: boolean
}) {
  const {
    feature,
    featureLayout,
    selected,
    config,
    ctx,
    bpPerPx,
    colorByCDS,
    // some subfeatures may be computed e.g. makeUTRs,
    // so these are passed as a prop, or feature.get('subfeatures') by default
    subfeatures = feature.get('subfeatures'),
  } = props

  const theme = createJBrowseTheme()
  const c = readConfObject(config, 'color2', { feature })
  const color2 = c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c

  const { left = 0, top = 0, width = 0, height = 0 } = featureLayout.absolute

  const y = top + height / 2

  ctx.strokeStyle = color2
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(left + width, y)
  ctx.stroke()

  subfeatures?.forEach(subfeature => {
    const subfeatureLayout = featureLayout.getSubRecord(String(subfeature.id()))
    // This subfeature got filtered out
    if (!subfeatureLayout) {
      return
    }
    const { GlyphComponent } = subfeatureLayout.data || {}
    if (GlyphComponent && (GlyphComponent as Glyph).draw) {
      ;(GlyphComponent as Glyph).draw({
        ...props,
        feature: subfeature,
        topLevel: false,
        featureLayout: subfeatureLayout,
        selected,
        ctx,
        bpPerPx,
        colorByCDS,
      })
    }
  })

  drawArrow(props)
}

const Segments = {
  draw: drawSegments,
}

export default Segments
