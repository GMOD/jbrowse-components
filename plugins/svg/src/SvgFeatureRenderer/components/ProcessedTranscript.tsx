import { readConfObject } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'

import Segments from './Segments'
import { makeUTRs } from './makeUTRs'
import { isUTR, layOutFeature, layOutSubfeatures } from './util'

import type { ExtraGlyphValidator } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

// returns a callback that will filter features features according to the
// subParts conf var
function makeSubpartsFilter(
  confKey: string | string[],
  config: AnyConfigurationModel,
) {
  const filter = readConfObject(config, confKey) as string[] | string
  const ret = typeof filter === 'string' ? filter.split(/\s*,\s*/) : filter

  return (feature: Feature) =>
    ret
      .map(typeName => typeName.toLowerCase())
      .includes(feature.get('type').toLowerCase())
}

function filterSubpart(feature: Feature, config: AnyConfigurationModel) {
  return makeSubpartsFilter('subParts', config)(feature)
}

function getSubparts(f: Feature, config: AnyConfigurationModel) {
  let c = f.get('subfeatures')
  if (!c || c.length === 0) {
    return []
  }
  const hasUTRs = c.some(child => isUTR(child))
  const isTranscript = ['mRNA', 'transcript'].includes(f.get('type'))
  const impliedUTRs = !hasUTRs && isTranscript

  // if we think we should use impliedUTRs, or it is specifically in the
  // config, then makeUTRs
  if (impliedUTRs || readConfObject(config, 'impliedUTRs')) {
    c = makeUTRs(f, c)
  }

  return c.filter(element => filterSubpart(element, config))
}

const ProcessedTranscript = observer(function ProcessedTranscript(props: {
  feature: Feature
  region: Region
  config: AnyConfigurationModel
  featureLayout: SceneGraph
  selected?: boolean
  reversed?: boolean
  [key: string]: unknown
}) {
  const { feature, config } = props
  const subfeatures = getSubparts(feature, config)

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
