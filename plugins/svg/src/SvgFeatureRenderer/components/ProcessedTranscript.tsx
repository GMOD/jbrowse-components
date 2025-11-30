import { observer } from 'mobx-react'

import Segments from './Segments'

import type { DisplayModel, FeatureLayout, RenderConfigContext } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

const ProcessedTranscript = observer(function (props: {
  feature: Feature
  region: Region
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  featureLayout: FeatureLayout
  displayModel?: DisplayModel
  colorByCDS: boolean
  bpPerPx: number
  topLevel?: boolean
}) {
  return <Segments {...props} />
})

export default ProcessedTranscript
