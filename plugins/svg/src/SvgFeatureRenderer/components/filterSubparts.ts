import { readConfObject } from '@jbrowse/core/configuration'

import { isUTR } from './isUTR'
import { makeUTRs } from './makeUTRs'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

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

export function filterSubpart(feature: Feature, config: AnyConfigurationModel) {
  return makeSubpartsFilter('subParts', config)(feature)
}

export function getSubparts(f: Feature, config: AnyConfigurationModel) {
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

  const subpartFilter = makeSubpartsFilter('subParts', config)
  return c.filter(subpartFilter)
}
