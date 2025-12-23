import { observer } from 'mobx-react'

import Segments from './Segments'
import { getSubparts } from './filterSubparts'
import { layOutFeature, layOutSubfeatures } from './util'

import type { DisplayModel, ExtraGlyphValidator } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

const ProcessedTranscript = observer(function ProcessedTranscript(props: {
  feature: Feature
  region: Region
  config: AnyConfigurationModel
  featureLayout: SceneGraph
  displayModel: DisplayModel
  selected?: boolean
  reversed?: boolean
}) {
  const { feature, config } = props
  return <Segments {...props} subfeatures={getSubparts(feature, config)} />
})

// @ts-expect-error
ProcessedTranscript.layOut = ({
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
  layOutSubfeatures({
    layout: subLayout,
    subfeatures: getSubparts(feature, config),
    bpPerPx,
    reversed,
    config,
    extraGlyphs,
  })
  return subLayout
}

export default ProcessedTranscript
