import { originTailId } from '@jbrowse/core/util/originCut'
import { doesIntersect2 } from '@jbrowse/core/util/range'

import type { LazyGffFeature } from 'gff-nostream'

/** Each sequence's length, as the file's `##sequence-region` pragmas state it. */
export function sequenceLengths(header: string) {
  const lengths = new Map<string, number>()
  for (const line of header.split('\n')) {
    const match = /^##sequence-region\s+(\S+)\s+\d+\s+(\d+)/.exec(line)
    if (match) {
      lengths.set(match[1]!, Number(match[2]))
    }
  }
  return lengths
}

function clip(
  feature: LazyGffFeature,
  start: number,
  end: number,
  shift: number,
): LazyGffFeature | undefined {
  const from = Math.max(feature.start, start)
  const to = Math.min(feature.end, end)
  return to > from
    ? {
        ...feature,
        start: from - shift,
        end: to - shift,
        subfeatures: feature.subfeatures.flatMap(
          child => clip(child, start, end, shift) ?? [],
        ),
      }
    : undefined
}

export interface Candidate {
  feature: LazyGffFeature
  uniqueId: string
}

/**
 * The candidates `query` overlaps, a feature crossing the origin of a
 * sequence `length` long cut there into the part before it and the part after.
 *
 * GFF3 writes such a feature on a circular sequence with its end past the
 * sequence's length, in "virtual" coordinates, so one record covers both
 * sides. Each half keeps the children that fall in it, clipped; the half
 * after the origin, shifted back onto the sequence, takes `originTailId` of
 * the id.
 */
export function* cutAtOrigin(
  candidates: Iterable<Candidate>,
  query: { start: number; end: number },
  length: number | undefined,
) {
  const seen = new Set<string>()
  for (const { feature, uniqueId } of candidates) {
    if (seen.has(uniqueId)) {
      continue
    }
    seen.add(uniqueId)
    const halves =
      length !== undefined && feature.end > length
        ? [
            { half: clip(feature, feature.start, length, 0), uniqueId },
            {
              half: clip(feature, length, feature.end, length),
              uniqueId: originTailId(uniqueId),
            },
          ]
        : [{ half: feature, uniqueId }]
    for (const { half, uniqueId: id } of halves) {
      if (
        half &&
        doesIntersect2(half.start, half.end, query.start, query.end)
      ) {
        yield { feature: half, uniqueId: id }
      }
    }
  }
}
