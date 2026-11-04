import { toLocale } from '@jbrowse/core/util'

import { PRESET_ATTRIBUTES, readChannelValue } from './attributeChannels.ts'
import { attributeTooltipLines } from './attributeTooltipLines.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * One side of a synteny block as its hover names it: the assembly, the name
 * the source gave that side (an ortholog's gene) where it gave one, and the
 * span with its length.
 */
export interface SyntenyBlockSide {
  assemblyName?: string
  name?: string
  refName: string
  start: number
  end: number
}

function sideLine({
  assemblyName,
  name,
  refName,
  start,
  end,
}: SyntenyBlockSide) {
  return [
    assemblyName,
    name,
    `${refName}:${toLocale(start + 1)}-${toLocale(end)}`,
    `(${toLocale(end - start)} bp)`,
  ]
    .filter(part => part !== undefined && part !== '')
    .join(' ')
}

// A syntenic depth of 1, a one-to-one pair, says nothing a reader needs
function withoutOneToOneDepth({
  syntenicDepth,
  ...rest
}: Record<string, number>) {
  return syntenicDepth === undefined || syntenicDepth === 1
    ? rest
    : { ...rest, syntenicDepth }
}

/**
 * A synteny block's description, the lines every view's hover shows for it:
 * each side's assembly, name and span, `Inverted` where the two sides run
 * opposite ways, and the numeric channels it carries, its syntenic depth only
 * where a gene has more than one partner. No arrow between the names, since an
 * ortholog pair has no direction and the sides' order differs by view.
 */
export function syntenyBlockLines({
  sides,
  inverted,
  attributes,
}: {
  sides: readonly SyntenyBlockSide[]
  inverted: boolean
  attributes: Record<string, number>
}) {
  return [
    ...sides.map(sideLine),
    ...(inverted ? ['Inverted'] : []),
    ...attributeTooltipLines(withoutOneToOneDepth(attributes)),
  ]
}

// a block's own channels; `meanIdentity` describes its query contig as a whole
const BLOCK_CHANNELS = PRESET_ATTRIBUTES.filter(name => name !== 'meanIdentity')

/**
 * The preset channels a block's record carries, keyed by channel name, for a
 * hover built off the record itself rather than a packed channel.
 */
export function blockAttributes(feature: Feature) {
  const out: Record<string, number> = {}
  for (const name of BLOCK_CHANNELS) {
    const value = readChannelValue(feature, name)
    if (typeof value === 'number' && !Number.isNaN(value)) {
      out[name] = value
    }
  }
  return out
}
