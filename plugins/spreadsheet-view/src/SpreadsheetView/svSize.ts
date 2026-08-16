import { SimpleFeature } from '@jbrowse/core/util'
import { parseSvAlt } from '@jbrowse/sv-core'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

/**
 * How big a structural variant is, which is not the number `end - start`
 * carries. A `<DEL>` spans exactly what it removes, so for that class the two
 * agree; an insertion occupies a single reference base and states its size in
 * `INFO.SVLEN`; and a breakend joining two chromosomes has no size within
 * either of them. Reading the footprint instead reported `1` for every INS and
 * every BND — 96 of the 210 calls in the C-GIAB somatic benchmark.
 *
 * A record whose two ends are on different chromosomes is answered first and
 * answered with nothing, ahead of even a declared `INFO.SVLEN`. Sniffles writes
 * one on its `<TRA>` records — every row of the SKBR3 callset carries a
 * `SVLEN=-1199826432` against a `CHR2=MT` — and it is the distance between two
 * coordinate systems, which is not a length. Trusting it turned a column that
 * used to read a useless `1` into one that read a confident 1.2 Gb.
 *
 * Past that `INFO.SVLEN` wins wherever a caller supplies it: it is the caller's
 * own answer, and it is the only one that can be right for an insertion.
 * Failing that the record's far end decides.
 */
export function svSize(data: SimpleFeatureSerialized) {
  const feature = new SimpleFeature(data)
  const alt = (feature.get('ALT') as string[] | undefined)?.[0]
  const parsed = parseSvAlt(feature, alt)
  const mate = feature.get('mate') as
    | { refName?: string; start?: number }
    | undefined
  const mateRefName = parsed?.mateRefName ?? mate?.refName
  if (mateRefName !== undefined && mateRefName !== data.refName) {
    return undefined
  }

  const info = feature.get('INFO') as Record<string, unknown[]> | undefined
  const declared = info?.SVLEN?.[0]
  // narrowed rather than coerced: `Number(null)` and `Number([])` are both 0,
  // so a malformed SVLEN would otherwise report a zero-length SV rather than
  // falling through to the endpoints
  const svLen =
    typeof declared === 'number'
      ? declared
      : typeof declared === 'string'
        ? Number(declared)
        : Number.NaN
  if (!Number.isNaN(svLen)) {
    return Math.abs(svLen)
  }

  // parseSvAlt's matePos is VCF 1-based; convert like its other consumers
  const matePos = parsed ? parsed.matePos - 1 : mate?.start
  const footprint = data.end - data.start
  if (matePos === undefined) {
    return footprint
  }
  // The footprint and the reach to the mate are each a lower bound on how far
  // the event extends, and which of them is the informative one depends on the
  // allele: a symbolic `<DEL>` already carries INFO.END in `end`, because
  // VcfFeature's `getEnd` put it there, while a breakend and a `<TRA>`
  // deliberately fall through to REF.length there and only the mate position
  // says. The larger picks the right one in both cases without restating
  // `getEnd`'s policy — restating it is what disagreed with it by a base.
  return Math.max(footprint, Math.abs(matePos - data.start))
}
