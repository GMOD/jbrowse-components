import { getAttribute } from '@gmod/gff-nostream'
import { originTailId } from '@jbrowse/core/util/originCut'
import { doesIntersect2 } from '@jbrowse/core/util/range'

import type { LazyGffFeature } from '@gmod/gff-nostream'

/**
 * The length of a circular sequence, off the line that declares it circular:
 * NCBI's `region` and Ensembl's `chromosome` both span the whole sequence and
 * carry `Is_circular=true`. Undefined for a sequence no such line declares,
 * which is never cut at its origin.
 */
export function circularLength(features: Iterable<LazyGffFeature>) {
  for (const feature of features) {
    if (
      feature.start === 0 &&
      getAttribute(feature, 'is_circular') === 'true'
    ) {
      return feature.end
    }
  }
  return undefined
}

/**
 * GFF3 phase counts the bases before the first whole codon from the feature's
 * 5' end, so a piece that loses `removed` bases off that end starts that much
 * further into the frame.
 */
function phaseAfterTrim(phase: number, removed: number) {
  return (((phase - removed) % 3) + 3) % 3
}

function clip(
  feature: LazyGffFeature,
  start: number,
  end: number,
  shift: number,
  inheritedStrand?: number,
): LazyGffFeature | undefined {
  const from = Math.max(feature.start, start)
  const to = Math.min(feature.end, end)
  const strand = feature.strand ?? inheritedStrand
  const removedAt5Prime =
    strand === -1 ? feature.end - to : from - feature.start
  return to > from
    ? {
        ...feature,
        start: from - shift,
        end: to - shift,
        phase:
          feature.phase === undefined
            ? undefined
            : phaseAfterTrim(feature.phase, removedAt5Prime),
        subfeatures: feature.subfeatures.flatMap((child, i) => {
          const piece = clip(child, start, end, shift, strand)
          return piece ? [{ ...piece, sourceIndex: i }] : []
        }),
      }
    : undefined
}

/**
 * A feature as a piece cut at the origin holds it. The piece keeps only the
 * children that fall in it, so each records `sourceIndex`, its place among its
 * parent's children in the file, and a piece's child ids name the same
 * children the whole feature's do (`wholeSubfeatureId`).
 */
export interface OriginPiece extends LazyGffFeature {
  sourceIndex?: number
}

export interface Candidate {
  feature: LazyGffFeature
  uniqueId: string
}

/**
 * The candidates `query` overlaps, a feature crossing the origin of a circular
 * sequence `length` long cut there into the part before it and the part after.
 *
 * GFF3 writes such a feature with its end past the sequence's length, in
 * "virtual" coordinates, so one record covers both sides. Each half keeps the
 * children that fall in it, clipped; the half after the origin, shifted back
 * onto the sequence, takes `originTailId` of the id.
 *
 * `whole` answers such a feature uncut, in the file's own coordinates, when
 * either half overlaps the query: the reader of one feature wants all of it.
 *
 * Not rejoined: the same feature written as two lines sharing an ID, `a..L`
 * and `1..b`, which the parser folds to one feature 1..L. Of NCBI, Bakta,
 * Ensembl, Prokka and BioPerl's bp_genbank2gff3, only the last writes it, and
 * it also writes that feature's CDS as one `polypeptide` 1..L, which no rejoin
 * mends (#5643).
 */
export function* cutAtOrigin(
  candidates: Iterable<Candidate>,
  query: { start: number; end: number },
  length: number | undefined,
  whole = false,
) {
  const seen = new Set<string>()
  for (const { feature, uniqueId } of candidates) {
    if (!seen.has(uniqueId)) {
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
      const overlapping = halves.flatMap(({ half, uniqueId: id }) =>
        half && doesIntersect2(half.start, half.end, query.start, query.end)
          ? [{ feature: half, uniqueId: id }]
          : [],
      )
      if (whole) {
        if (overlapping.length > 0) {
          yield { feature, uniqueId }
        }
      } else {
        yield* overlapping
      }
    }
  }
}
