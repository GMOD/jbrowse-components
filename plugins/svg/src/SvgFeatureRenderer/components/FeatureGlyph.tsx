import { observer } from 'mobx-react'

import type { DisplayModel } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

const FeatureGlyph = observer(function FeatureGlyph(props: {
  feature: Feature
  rootLayout: SceneGraph
  config: AnyConfigurationModel
  name: string
  description: string
  shouldShowName: boolean
  shouldShowDescription: boolean
  colorByCDS: boolean
  fontHeight: number
  allowedWidthExpansion: number
  exportSVG?: unknown
  displayModel?: DisplayModel
  selected?: boolean
  reversed?: boolean
  topLevel?: boolean
  region: Region
  bpPerPx: number
}) {
  const { feature, rootLayout } = props

  const featureLayout = rootLayout.getSubRecord(String(feature.id()))
  if (!featureLayout) {
    return null
  } else {
    const { GlyphComponent } = featureLayout.data || {}
    return <GlyphComponent featureLayout={featureLayout} {...props} />
  }
})

export default FeatureGlyph
