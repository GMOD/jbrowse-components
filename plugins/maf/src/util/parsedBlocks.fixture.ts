// Blocks as plain objects, for tests that assert on a parse: what a reader
// hands the sink, reassembled through `MafFeatureSink`.
import { readMafBlocks } from '../BgzipMafAdapter/mafParsing.ts'
import { readTafBlock } from '../BgzipTaffyAdapter/tafParsing.ts'
import { MafFeatureSink } from './mafFeatureSink.ts'
import { MafStanzaReader } from './mafStanzaReader.ts'

import type BgzipTaffyAdapter from '../BgzipTaffyAdapter/BgzipTaffyAdapter.ts'
import type { AlignmentBlock } from '../BgzipTaffyAdapter/tafParsing.ts'
import type MafFeature from '../MafFeature.ts'
import type { AlignmentRecord, EmptyRecord } from '../types.ts'
import type { SourceResolver } from './parseAssemblyName.ts'

export interface ParsedBlock {
  uniqueId: string
  refSrc: string
  refSampleId: string | undefined
  start: number
  end: number
  seq: string
  alignments: Record<string, AlignmentRecord>
  empties: Record<string, EmptyRecord>
}

export function readerOf(resolve: SourceResolver) {
  return new MafStanzaReader({ resolve, reportUnmatched: () => {} })
}

/** Collect what `read` emits, with each block's reference source token. */
export function collectBlocks(
  read: (sink: MafFeatureSink, keep: (refSrc: string) => boolean) => void,
): ParsedBlock[] {
  const refSrcs: string[] = []
  const features: MafFeature[] = []
  const sink = new MafFeatureSink('', f => {
    features.push(f)
  })
  read(sink, refSrc => {
    refSrcs.push(refSrc)
    return true
  })
  sink.finish()
  return features.map((f, i) => ({
    uniqueId: f.id(),
    refSrc: refSrcs[i]!,
    refSampleId: f.get('refSampleId') as string | undefined,
    start: f.get('start'),
    end: f.get('end'),
    seq: f.get('seq'),
    alignments: f.get('alignments'),
    empties: f.get('empties'),
  }))
}

/** The blocks of a bgzip MAF slice. */
export function mafBlocksOf(text: string, resolve: SourceResolver) {
  const reader = readerOf(resolve)
  return collectBlocks((sink, keep) => {
    readMafBlocks(text, offset => `${offset}`, reader, sink, keep)
  })
}

/** A finalized TAF block, or undefined where it has no rows or columns. */
export function tafBlockOf(block: AlignmentBlock, resolve: SourceResolver) {
  const reader = readerOf(resolve)
  return collectBlocks((sink, keep) => {
    readTafBlock(block, reader, sink, keep, 'block')
  })[0]
}

/** The blocks of a decoded TAF slice, every one kept. */
export function tafSliceBlocksOf(
  adapter: BgzipTaffyAdapter,
  bytes: Uint8Array,
  runLengthEncodeBases: boolean,
  resolve: SourceResolver,
) {
  const reader = readerOf(resolve)
  return collectBlocks((sink, keep) => {
    adapter.readTafSlice(
      {
        text: new TextDecoder().decode(bytes),
        blockIdAt: offset => `${offset}`,
      },
      runLengthEncodeBases,
      reader,
      sink,
      keep,
    )
  })
}
