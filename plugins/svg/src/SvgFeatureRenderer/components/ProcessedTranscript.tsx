import { observer } from 'mobx-react'

import Segments from './Segments'
import { getSubparts } from './filterSubparts'
import { layOutFeature, layOutSubfeatures } from './util'

import { useFeatureSequence } from '@jbrowse/core/BaseFeatureWidget/SequenceFeatureDetails/useFeatureSequence'
import { getSession } from '@jbrowse/core/util'

import type { ExtraGlyphValidator } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

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
  const session = displayModel ? getSession(displayModel) : undefined
  const { assemblyName } = region
  const { sequence, error } = useFeatureSequence({
    session,
    assemblyName,
    feature,
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
