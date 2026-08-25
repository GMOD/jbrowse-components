import { orientAlignment, pafIdentity } from '@jbrowse/cigar-utils'
import { fetchAndMaybeUnzip, updateStatus } from '@jbrowse/core/util'

import SyntenyFeature from '../SyntenyFeature/index.ts'
import {
  collectLines,
  copyPafTags,
  getOrCreate,
  indexRecordsByName,
  parsePAFLine,
} from '../util.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
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
// the result is a single identity that says e.g. chr5 from human mapped to
// chr5 on mouse at 0.8 identity, and that 0.8 is then attached to all the
// pieces of chr5 on human that mapped to chr5 on mouse — so a query split
// across many hits is colored by its overall identity to the target.

interface WeightedSum {
  idSum: number
  weightSum: number
}

export function getWeightedMeans(records: PAFRecord[]) {
  // Length-weighted identity sums per query-target pair. Nested maps rather
  // than a `${qname}-${tname}` key: a contig name can contain any character
  // one would reach for as a separator, so `HLA-A` vs `B` and `HLA` vs `A-B`
  // used to share a sum and average each other's identity. A plain object was
  // also unsafe with names as keys — `map['constructor']` finds Object.
  const byQuery = new Map<string, Map<string, WeightedSum>>()
  // The sum each record belongs to, so the second pass costs an array read
  // rather than a second pair of hash lookups.
  const sums: WeightedSum[] = []
  for (const record of records) {
    const byTarget = getOrCreate(byQuery, record.qname, () => new Map())
    const sum = getOrCreate(byTarget, record.tname, () => ({
      idSum: 0,
      weightSum: 0,
    }))
    const len = record.extra.blockLen ?? 1
    sum.idSum += pafIdentity(record.extra) * len
    sum.weightSum += len
    sums.push(sum)
  }

  // Mean identity is a true [0,1] fraction, so it shares the per-alignment
  // identity color scale. A pair whose every row states a zero block length
  // has no weights to average, and 0/0 put a NaN on the color ramp.
  for (const [i, record] of records.entries()) {
    const { idSum, weightSum } = sums[i]!
    record.extra.meanIdentity = weightSum > 0 ? idSum / weightSum : 0
  }

  return records
}

/**
 * The two sides of the file indexed by refName, in the order `assemblyNames`
 * gives them: index 0 is the PAF query (`qname`) side, index 1 the target
 * (`tname`) side — so a query's assembly index selects its own index directly.
 */
export function indexPafRecords(records: PAFRecord[]) {
  return [
    indexRecordsByName(records, r => r.qname),
    indexRecordsByName(records, r => r.tname),
  ] as const
}

export function parsePafBuffer(buffer: Uint8Array, opts?: BaseOptions) {
  return collectLines({
    buffer,
    label: 'Parsing PAF',
    parseLine: parsePAFLine,
    opts,
  })
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
  const { qname, qstart, qend, tname, tstart, tend, strand } = record
  // `strand` rides along unflipped: it says whether the two sequences run the
  // same way, which is a property of the pair and not of which end you read it
  // from. markReciprocalDuplicates needs it to test the boundary offsets on the
  // right diagonal.
  return flip
    ? {
        refName: qname,
        start: qstart,
        end: qend,
        mateRefName: tname,
        mateStart: tstart,
        mateEnd: tend,
        strand,
      }
    : {
        refName: tname,
        start: tstart,
        end: tend,
        mateRefName: qname,
        mateStart: qstart,
        mateEnd: qend,
        strand,
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
  const { numMatches = 0, blockLen = 1, cg, cs } = extra
  const { CIGAR, cs: orientedCs } = orientAlignment({ cg, cs, flip, strand })
  // The perspective is part of the identity, not just the row: a self-alignment
  // serves one row from both of its ends against one assembly name, and those
  // are two features that have to draw — and be picked, and dedupe — apart. The
  // separators also keep `1` + `2asm` from reading as `12` + `asm`.
  const data: SimpleFeatureSerialized = {
    uniqueId: `${syntenyId}-${flip ? 'q' : 't'}-${assemblyName}`,
    assemblyName,
    start,
    end,
    type: 'match',
    refName,
    strand,
    CIGAR,
    cs: orientedCs,
    syntenyId,
    identity: pafIdentity(extra),
    numMatches,
    blockLen,
    mate,
  }
  // the tags land after the fields above rather than before them — see
  // copyPafTags, which is also where the three it drops are accounted for
  copyPafTags(data, extra)
  return new SyntenyFeature(data)
}
