import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// feature fields are `unknown` off the serialized feature's index signature
function num(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

/**
 * The one line under a hit's location. A BLAT hit is judged on identity and on
 * how much of the query it accounts for (a 99% hit over a tenth of the query is
 * not the locus you searched for), an hgPcr product on its size and the primer
 * pair that made it. Built from the fields the feature actually carries, so it
 * can't claim a number the hit doesn't have.
 */
export function hitSummary(feature: SimpleFeatureSerialized) {
  const identity = num(feature.identity)
  const coverage = num(feature.coverage)
  const forward = text(feature.forwardPrimer)
  const reverse = text(feature.reversePrimer)
  return identity === undefined
    ? [text(feature.name), forward && reverse ? `${forward} / ${reverse}` : '']
        .filter(Boolean)
        .join(', ')
    : [
        text(feature.queryName),
        `${identity}% identity`,
        coverage === undefined ? '' : `${coverage}% of query`,
      ]
        .filter(Boolean)
        .join(', ')
}
