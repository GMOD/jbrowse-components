import {
  defaultCodonTable,
  generateCodonTable,
  getSession,
} from '@jbrowse/core/util'
import { convertCodingSequenceToPeptides } from '@jbrowse/core/util/convertCodingSequenceToPeptides'
import { useFeatureSequence } from '@jbrowse/core/util/useFeatureSequence'
import { observer } from 'mobx-react'

import Segments from './Segments'
import { getSubparts } from './filterSubparts'
import { layOutFeature, layOutSubfeatures } from './util'

import type { ExtraGlyphValidator } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

const ProcessedTranscript = observer(function (props: {
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
  const { sequence } = useFeatureSequence({
    session,
    assemblyName,
    feature,
    upDownBp: 0,
    forceLoad: true,
  })

  const start = feature.get('start')
  const cds =
    feature
      .toJSON()
      .subfeatures?.filter(sub => sub.type?.toLowerCase() === 'cds')
      ?.sort((a, b) => a.start - b.start)
      .map(sub => ({
        ...sub,
        start: sub.start - start,
        end: sub.end - start,
      })) || []
  const peptides =
    sequence && !('error' in sequence)
      ? convertCodingSequenceToPeptides({
          cds,
          sequence: sequence.seq,
          codonTable: generateCodonTable(defaultCodonTable),
        })
      : undefined

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
