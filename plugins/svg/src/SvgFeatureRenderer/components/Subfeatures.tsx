import { observer } from 'mobx-react'

import type { DisplayModel, FeatureLayout, RenderConfigContext } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

const Subfeatures = observer(function Subfeatures(_props: {
  feature: Feature
  region: Region
  featureLayout: FeatureLayout
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  colorByCDS: boolean
  bpPerPx: number
  displayModel?: DisplayModel
  topLevel?: boolean
}) {
  // Subfeatures component renders nothing itself - children are rendered by FeatureGlyph
  return null
})

export default Subfeatures
