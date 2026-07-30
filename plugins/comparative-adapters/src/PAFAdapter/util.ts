import { pafIdentity } from '@jbrowse/cigar-utils'
import { fetchAndMaybeUnzip, updateStatus } from '@jbrowse/core/util'

import SyntenyFeature from '../SyntenyFeature/index.ts'
import { orientAlignment } from '../csUtils.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { GenericFilehandle } from 'generic-filehandle2'

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
// the result is a single identity that says e.g. chr5 from human mapped to
// chr5 on mouse at 0.8 identity, and that 0.8 is then attached to all the
// pieces of chr5 on human that mapped to chr5 on mouse — so a query split
// across many hits is colored by its overall identity to the target.

export function getWeightedMeans(ret: PAFRecord[]) {
  // One pass: length-weighted identity sums per query-target pair.
  const map: Record<string, { idSum: number; weightSum: number }> = {}
  for (const entry of ret) {
    const key = `${entry.qname}-${entry.tname}`
    const len = entry.extra.blockLen ?? 1
    const id = pafIdentity(entry.extra)
    const e = map[key]
    if (e) {
      e.idSum += id * len
      e.weightSum += len
    } else {
      map[key] = { idSum: id * len, weightSum: len }
    }
  }

  // Mean identity is a true [0,1] fraction, so it shares the per-alignment
  // identity color scale.
  for (const entry of ret) {
    const key = `${entry.qname}-${entry.tname}`
    const { idSum, weightSum } = map[key]!
    entry.extra.meanIdentity = idSum / weightSum
  }

  return ret
}

/**
 * The whole setup of every in-memory pairwise adapter: download the file, hand
 * the buffer to a format-specific `parse`, then attach the per-pair
 * weighted-mean identity. Written once so the five formats (PAF, MashMap,
 * delta, chain, all-vs-all PAF) can't drift on their progress phases — the
 * identity pass in particular walks every record twice and used to run
 * unlabelled, holding the parse's last percentage on screen while it did.
 */
export async function loadPafRecords<T extends PAFRecord>({
  file,
  parse,
  opts,
}: {
  file: GenericFilehandle
  parse: (buffer: Uint8Array, opts?: BaseOptions) => T[]
  opts?: BaseOptions
}) {
  const buffer = await fetchAndMaybeUnzip(file, opts)
  const records = parse(buffer, opts)
  return updateStatus('Computing identities', opts?.statusCallback, () =>
    getWeightedMeans(records),
  )
}

/**
 * Resolve a PAF record to the perspective the view is anchored on: `flip` (the
 * queried assembly is the PAF query side) puts the q* columns on the feature
 * and the t* columns on the mate, otherwise the reverse. Shared by the two
 * in-memory PAF adapters, which each spelled out the same six ternaries.
 */
export function orientPafRecord(record: PAFRecord, flip: boolean) {
  const { qname, qstart, qend, tname, tstart, tend } = record
  return flip
    ? {
        refName: qname,
        start: qstart,
        end: qend,
        mateRefName: tname,
        mateStart: tstart,
        mateEnd: tend,
      }
    : {
        refName: tname,
        start: tstart,
        end: tend,
        mateRefName: qname,
        mateStart: qstart,
        mateEnd: qend,
      }
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
  // `id` (odgi untangle's identity tag) is read by pafIdentity below and then
  // dropped rather than spread: as feature data it becomes the feature's `id`,
  // which the synteny tooltip falls back to for a name — so a row tagged
  // id:f:0.98 labelled itself "0.98".
  const { numMatches = 0, blockLen = 1, cg, cs, id: _id, ...rest } = extra
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
