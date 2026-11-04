import { formatLocationRange } from '@jbrowse/alignments-core'
import { valueText } from '@jbrowse/core/util/groupKeys'

import { readFieldReader } from './groupFeatures.ts'

import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

function compiledReader(field: string, jexl: JexlInstance | undefined) {
  try {
    return readFieldReader(field, jexl)
  } catch {
    return undefined
  }
}

function textOf(read: (feature: Feature) => unknown, feature: Feature) {
  try {
    return valueText(read(feature))
  } catch {
    return undefined
  }
}

// Each read's text, or none when the first read throws: a v4 `mouseover`
// naming a since-removed jexl function throws on every read, and a deep BAM
// would pay a throw per read on every fetch to ship nothing
function textsOf(read: (feature: Feature) => unknown, features: Feature[]) {
  const first = features[0] && textOf(read, features[0])
  return first === undefined
    ? []
    : [first, ...features.slice(1).map(f => textOf(read, f) ?? '')]
}

/**
 * Each read's `tooltip.field` value, the read hover's first line. A field
 * that reads nothing, or throws, as a v4 `mouseover` naming a since-removed
 * jexl function does, reads `''`, which the hover answers with the read's
 * name, as the feature displays' `tooltip.field` falls back. Undefined when no
 * read has one, so a field nothing answers ships nothing.
 */
export function buildReadTooltipValues(
  features: Feature[],
  field: string,
  jexl: JexlInstance | undefined,
) {
  const read = compiledReader(field, jexl)
  const values = read ? textsOf(read, features) : []
  return values.some(v => v !== '') ? values : undefined
}

interface BlockMate {
  refName: string
  start: number
  end: number
  name?: unknown
  assemblyName?: unknown
}

function isBlockMate(value: unknown): value is BlockMate {
  return (
    typeof value === 'object' &&
    value !== null &&
    'refName' in value &&
    typeof value.refName === 'string' &&
    'start' in value &&
    typeof value.start === 'number' &&
    'end' in value &&
    typeof value.end === 'number'
  )
}

function mateLineOf(mate: unknown) {
  return isBlockMate(mate)
    ? [
        mate.name,
        mate.assemblyName,
        formatLocationRange(mate.refName, mate.start, mate.end),
      ]
        .filter(part => typeof part === 'string' && part !== '')
        .join(' ')
    : ''
}

/**
 * Each synteny block's other side, as the hover's `Mate:` line: its name
 * where the source gives one (an ortholog in an MCScan anchors file), its
 * assembly and its span. Undefined when no read carries a mate, which no BAM
 * or CRAM record does: their `get('mate')` falls through to `undefined`
 * without decoding anything.
 */
export function buildReadMateLines(features: Feature[]) {
  return features.some(f => isBlockMate(f.get('mate')))
    ? features.map(f => mateLineOf(f.get('mate')))
    : undefined
}
