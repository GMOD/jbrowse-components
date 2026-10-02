// The MAF-tabix and bigMaf parses `getFeatures` ran before it read through
// `readBlocks`, and the identity walk clustering ran over their MafFeatures:
// the oracle the rebuilt paths are held equal to, and the bench's baseline.
import { isUnknownBase } from '@jbrowse/core/util/alignedBytes'
import {
  ObservableCreate,
  subscribeToObservable,
} from '@jbrowse/core/util/rxjs'

import { buildSegments } from '../LinearMafClusterIdentityRpc/buildIdentityMatrix.ts'
import MafFeature from '../MafFeature.ts'
import { buildSampleFilter } from './getSamples.ts'
import { MafStanzaRows, applyMafLine } from './mafLines.ts'
import { makeSourceResolver } from './parseAssemblyName.ts'

import type { AlignmentRecord, MafAdapterOptions } from '../types.ts'
import type { SourceResolver } from './parseAssemblyName.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import type { Observable } from 'rxjs'

const MINUS_CHAR = 45
const GAP = 45

export function scanMafTabixEntry(
  text: string,
  from: number,
  to: number,
  resolve: SourceResolver,
) {
  const c0 = text.indexOf(':', from)
  if (c0 === -1 || c0 >= to || c0 === from) {
    return undefined
  }
  const c1 = text.indexOf(':', c0 + 1)
  const c2 = c1 === -1 ? -1 : text.indexOf(':', c1 + 1)
  const c3 = c2 === -1 ? -1 : text.indexOf(':', c2 + 1)
  const c4 = c3 === -1 ? -1 : text.indexOf(':', c3 + 1)
  if (c4 === -1 || c4 >= to || c4 + 1 === to) {
    return undefined
  }
  const parsed = resolve(text.slice(from, c0))
  if (!parsed?.assemblyName) {
    return undefined
  }
  return {
    assemblyName: parsed.assemblyName,
    chr: parsed.chr,
    srcStart: parseInt(text.slice(c0 + 1, c1), 10),
    strand: text.charCodeAt(c2 + 1) === MINUS_CHAR ? -1 : 1,
    srcSize: parseInt(text.slice(c3 + 1, c4), 10),
    seq: text.slice(c4 + 1, to),
  }
}

export function selectReferenceSequenceString(
  alignments: Record<string, { seq: string }>,
  refAssemblyName: string | undefined,
  queryAssemblyName: string | undefined,
  firstEntrySeq: string | undefined,
) {
  for (const name of [refAssemblyName, queryAssemblyName]) {
    if (name && alignments[name]) {
      return alignments[name].seq
    }
  }
  return firstEntrySeq
}

export function parseBigMafStanza(maf: string, resolve: SourceResolver) {
  const rows = new MafStanzaRows()
  let referenceSeq: string | undefined
  for (const line of maf.split(';')) {
    const s = applyMafLine(line, resolve, rows)
    referenceSeq ??= s?.seq
  }
  return {
    alignments: rows.alignments,
    empties: rows.empties,
    referenceSeq: referenceSeq ?? '',
  }
}

export function legacyMafTabixFeatures(
  bed: BaseFeatureDataAdapter,
  query: Region,
  opts?: MafAdapterOptions,
  refAssemblyName = '',
) {
  return ObservableCreate<Feature>(async observer => {
    const resolver = makeSourceResolver(buildSampleFilter(opts))
    const anySource = makeSourceResolver()
    await subscribeToObservable(bed.getFeatures(query, opts), feature => {
      const encoded = feature.get('field5') as string
      const alignments: Record<string, AlignmentRecord> = {}
      let firstEntrySeq: string | undefined
      for (let from = 0, l = encoded.length; from < l;) {
        let to = encoded.indexOf(',', from)
        if (to === -1) {
          to = l
        }
        const entry = scanMafTabixEntry(encoded, from, to, resolver.resolve)
        if (entry) {
          const { assemblyName, chr, srcStart, strand, srcSize, seq } = entry
          alignments[assemblyName] = { chr, srcStart, strand, srcSize, seq }
        }
        if (from === 0) {
          firstEntrySeq = (
            entry ?? scanMafTabixEntry(encoded, 0, to, anySource.resolve)
          )?.seq
        }
        from = to + 1
      }
      observer.next(
        new MafFeature(
          feature.id(),
          feature.get('start'),
          feature.get('end'),
          feature.get('refName'),
          0,
          alignments,
          selectReferenceSequenceString(
            alignments,
            refAssemblyName,
            query.assemblyName,
            firstEntrySeq,
          ) ?? '',
        ),
      )
    })
    observer.complete()
  }, opts?.signal)
}

export function legacyBigMafFeatures(
  bigBed: BaseFeatureDataAdapter,
  query: Region,
  opts?: MafAdapterOptions,
) {
  return ObservableCreate<Feature>(async observer => {
    const resolver = makeSourceResolver(buildSampleFilter(opts))
    await subscribeToObservable(bigBed.getFeatures(query, opts), feature => {
      const { alignments, empties, referenceSeq } = parseBigMafStanza(
        feature.get('mafBlock') as string,
        resolver.resolve,
      )
      observer.next(
        new MafFeature(
          feature.id(),
          feature.get('start'),
          feature.get('end'),
          feature.get('refName'),
          0,
          alignments,
          referenceSeq,
          empties,
        ),
      )
    })
    observer.complete()
  }, opts?.signal)
}

export async function legacyIdentityMatrix(
  getFeatures: (region: Region) => Observable<Feature>,
  regions: Region[],
  sources: string[],
) {
  const { segments, columns } = buildSegments(regions)
  const matched = new Map<string, Float32Array>()
  for (const name of sources) {
    matched.set(name, new Float32Array(columns))
  }
  const covered = new Float32Array(columns)
  let columnBin = new Int32Array(0)
  let refFolded = new Uint8Array(0)
  for (const [regionIndex, region] of regions.entries()) {
    const segment = segments[regionIndex]!
    await subscribeToObservable(getFeatures(region), feature => {
      const refSeq = feature.get('seq') as string
      const alignments = feature.get('alignments') as Record<
        string,
        AlignmentRecord
      >
      if (columnBin.length < refSeq.length) {
        columnBin = new Int32Array(refSeq.length)
        refFolded = new Uint8Array(refSeq.length)
      }
      let refPos = feature.get('start')
      for (let c = 0; c < refSeq.length; c++) {
        const refCode = refSeq.charCodeAt(c)
        refFolded[c] = refCode | 32
        if (refCode === GAP) {
          columnBin[c] = -1
          continue
        }
        if (
          refPos >= segment.start &&
          refPos < segment.end &&
          !isUnknownBase(refCode)
        ) {
          const bin =
            segment.colOffset +
            Math.min(
              segment.columns - 1,
              Math.floor((refPos - segment.start) / segment.binWidth),
            )
          columnBin[c] = bin
          covered[bin]! += 1
        } else {
          columnBin[c] = -1
        }
        refPos++
      }
      for (const sampleId in alignments) {
        const row = matched.get(sampleId)
        if (!row) {
          continue
        }
        const { seq } = alignments[sampleId]!
        const n = Math.min(seq.length, refSeq.length)
        for (let c = 0; c < n; c++) {
          const bin = columnBin[c]!
          if (bin < 0) {
            continue
          }
          const base = seq.charCodeAt(c)
          if (base !== GAP && (base | 32) === refFolded[c]!) {
            row[bin]! += 1
          }
        }
      }
    })
  }
  for (const row of matched.values()) {
    for (let bin = 0; bin < columns; bin++) {
      const denominator = covered[bin]!
      row[bin] = denominator > 0 ? row[bin]! / denominator : 0
    }
  }
  return matched
}

/**
 * What two lists of MafFeatures must agree on: each one's JSON, and the order
 * its `alignments` and `empties` list their species in, which JSON equality
 * does not see.
 */
export function featureView(features: Feature[]) {
  return features.map(f => ({
    json: f.toJSON(),
    rows: Object.keys(f.get('alignments') as object),
    empties: Object.keys(f.get('empties') as object),
  }))
}
