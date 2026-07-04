import SyntenyFeature from '../SyntenyFeature/index.ts'
import { orientAlignment } from '../csUtils.ts'
import { pafIdentity } from '../util.ts'

export interface PAFRecord {
  qname: string
  qstart: number
  qend: number
  tname: string
  tstart: number
  tend: number
  strand: number
  extra: {
    cg?: string
    cs?: string
    blockLen?: number
    mappingQual?: number
    numMatches?: number
    meanScore?: number
    meanIdentity?: number
    [key: string]: string | number | undefined
  }
}
// based on "weighted mean" method from https://github.com/tpoorten/dotPlotly
// License reproduced here
//
// MIT License

// Copyright (c) 2017 Tom Poorten

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Notes: in the weighted mean longer alignments factor in more heavily of all
// the fragments of a query vs the reference that it mapped to
//
// this uses a combined key query+'-'+ref to iteratively map all the alignments
// that match a particular ref from a particular query (so 1d array of what
// could be a 2d map)
//
// the result is a single number that says e.g. chr5 from human mapped to chr5
// on mouse with 0.8 quality, and that 0.8 is then attached to all the pieces
// of chr5 on human that mapped to chr5 on mouse. if chr5 on human also more
// weakly mapped to chr6 on mouse, then it would have another value e.g. 0.6.
// this can show strong and weak levels of synteny, especially in polyploidy
// situations

export function getWeightedMeans(ret: PAFRecord[]) {
  // One pass: length-weighted sums per query-target pair, for both MAPQ (→
  // normalized "synteny strength") and sequence identity.
  const map: Record<
    string,
    { mapqSum: number; idSum: number; weightSum: number }
  > = {}
  for (const entry of ret) {
    const key = `${entry.qname}-${entry.tname}`
    // MAPQ 255 is the PAF spec sentinel for "not computed" — treat as missing,
    // not as a high-quality signal (which would massively upweight such records).
    const mapq = entry.extra.mappingQual
    const qual = mapq !== undefined && mapq !== 255 ? mapq : 1
    const len = entry.extra.blockLen ?? 1
    const id = pafIdentity(entry.extra)
    const e = map[key]
    if (e) {
      e.mapqSum += qual * len
      e.idSum += id * len
      e.weightSum += len
    } else {
      map[key] = { mapqSum: qual * len, idSum: id * len, weightSum: len }
    }
  }

  // Mean MAPQ is min-max normalized across pairs (the dotPlotly "weighted mean"
  // method — surfaces relative strong vs weak synteny, e.g. polyploidy). Mean
  // identity stays a true [0,1] fraction so it shares the per-alignment
  // identity color scale.
  const meanMapq: Record<string, number> = {}
  let min = Infinity
  let max = -Infinity
  for (const [key, { mapqSum, weightSum }] of Object.entries(map)) {
    const mean = mapqSum / weightSum
    meanMapq[key] = mean
    min = Math.min(mean, min)
    max = Math.max(mean, max)
  }

  const range = max - min
  for (const entry of ret) {
    const key = `${entry.qname}-${entry.tname}`
    const { idSum, weightSum } = map[key]!
    // When all pairs have identical quality (range === 0), use 0.5 rather than
    // 1 so the encoding reads as "neutral" instead of "maximum quality."
    entry.extra.meanScore = range > 0 ? (meanMapq[key]! - min) / range : 0.5
    entry.extra.meanIdentity = idSum / weightSum
  }

  return ret
}

// Build a SyntenyFeature from a parsed PAF row already resolved to the
// perspective the view is anchored on. Shared by PAFAdapter and
// AllVsAllPAFAdapter, which differ only in how they derive start/end/refName
// and the mate (raw names vs PanSN-stripped) — the orientation, identity and
// feature construction are identical. `flip` is true when the queried assembly
// is the PAF query side.
export function makeSyntenyFeature({
  syntenyId,
  assemblyName,
  refName,
  start,
  end,
  strand,
  extra,
  flip,
  mate,
}: {
  syntenyId: number
  assemblyName: string
  refName: string
  start: number
  end: number
  strand: number
  extra: PAFRecord['extra']
  flip: boolean
  mate: { refName: string; start: number; end: number; assemblyName: string }
}) {
  const { numMatches = 0, blockLen = 1, cg, cs, ...rest } = extra
  const { CIGAR, cs: orientedCs } = orientAlignment({ cg, cs, flip, strand })
  return new SyntenyFeature({
    uniqueId: syntenyId + assemblyName,
    assemblyName,
    start,
    end,
    type: 'match',
    refName,
    strand,
    ...rest,
    CIGAR,
    cs: orientedCs,
    syntenyId,
    identity: pafIdentity(extra),
    numMatches,
    blockLen,
    mate,
  })
}
