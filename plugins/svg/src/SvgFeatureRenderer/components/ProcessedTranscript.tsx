import { observer } from 'mobx-react'

import Segments from './Segments'
import { getSubparts } from './filterSubparts'
import { layOutFeature, layOutSubfeatures } from './util'

import type { ExtraGlyphValidator } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { getSession, type Feature, type Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'
import { useFeatureSequence } from '@jbrowse/core/BaseFeatureWidget/SequenceFeatureDetails/hooks'

const ProcessedTranscript = observer(function ProcessedTranscript(props: {
  feature: Feature
  region: Region
  config: AnyConfigurationModel
  featureLayout: SceneGraph
  displayModel: unknown
  selected?: boolean
  reversed?: boolean
}) {
  const { region, displayModel, feature, config } = props
  const subfeatures = getSubparts(feature, config)
  console.log({ displayModel })
  const session = getSession(displayModel)
  const { assemblyName } = region
  const { sequence, error } = useFeatureSequence({
    session,
    assemblyName,
    feature: feature.toJSON(),
    upDownBp: 0,
    forceLoad: true,
  })

  console.log({ sequence, error })

  // we manually compute some subfeatures, so pass these separately
  return <Segments {...props} subfeatures={subfeatures} />
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
  const subfeatures = getSubparts(feature, config)
  layOutSubfeatures({
    layout: subLayout,
    subfeatures,
    bpPerPx,
    reversed,
    config,
    extraGlyphs,
  })
  return subLayout
}

export default ProcessedTranscript
