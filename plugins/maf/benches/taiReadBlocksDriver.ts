// What `taiReadBlocks.bench.ts` bundles once per arm: the two `.tai` readers
// over a decompressed slice, keeping what `MafTaiAdapterBase.readBlocks` keeps.
// Its `blockOverlaps` is restated rather than imported, so an arm bundles the
// readers and not the adapter classes around them.
import { readMafBlocks } from '../src/BgzipMafAdapter/mafParsing.ts'
import { readTafSlice } from '../src/BgzipTaffyAdapter/tafParsing.ts'
import { MafStanzaReader } from '../src/util/mafStanzaReader.ts'
import { makeSourceResolver } from '../src/util/parseAssemblyName.ts'
import { makeRefNameFilter } from '../src/util/taiIndex.ts'

import type { AlignmentContext, EmptyRecord } from '../src/types.ts'
import type { MafBlockSink } from '../src/util/mafBlockSink.ts'

export interface SliceQuery {
  refName: string
  start: number
  end: number
}

/** Counts what it is handed, so the timed read pays next to nothing for it. */
class CountingSink implements MafBlockSink {
  blocks = 0
  rows = 0
  bases = 0

  startBlock() {
    this.blocks++
  }

  addRow(_sampleId: string, _text: string, from: number, to: number) {
    this.rows++
    this.bases += to - from
  }

  addEmpty() {}
}

/** Everything a reader hands over, as text two arms can compare. */
class RecordingSink implements MafBlockSink {
  lines: string[] = []

  startBlock(
    id: string,
    start: number,
    end: number,
    ref: string,
    refFrom: number,
    refTo: number,
    refSampleId: string | undefined,
  ) {
    this.lines.push(
      `block ${id} ${start} ${end} ${refSampleId} ${ref.slice(refFrom, refTo)}`,
    )
  }

  addRow(
    sampleId: string,
    text: string,
    from: number,
    to: number,
    srcRefName: string,
    srcStart: number,
    strand: number,
    srcSize: number,
    context: AlignmentContext | undefined,
  ) {
    this.lines.push(
      `row ${sampleId} ${srcRefName} ${srcStart} ${strand} ${srcSize} ${JSON.stringify(context)} ${text.slice(from, to)}`,
    )
  }

  addEmpty(sampleId: string, empty: EmptyRecord) {
    this.lines.push(`empty ${sampleId} ${JSON.stringify(empty)}`)
  }
}

function keepFor(query: SliceQuery) {
  const onQueriedRefName = makeRefNameFilter(query.refName)
  return (refSrc: string, start: number, end: number) =>
    (start === end ? start >= query.start : end > query.start) &&
    start < query.end &&
    onQueriedRefName(refSrc)
}

const blockIdAt = (offset: number) => `${offset}`

function readMaf(text: string, query: SliceQuery, sink: MafBlockSink) {
  const reader = new MafStanzaReader(makeSourceResolver())
  readMafBlocks(text, blockIdAt, reader, sink, keepFor(query))
}

// A base that predates `pastQuery` ignores the argument.
function readTaf(text: string, query: SliceQuery, sink: MafBlockSink) {
  const reader = new MafStanzaReader(makeSourceResolver())
  const onQueriedRefName = makeRefNameFilter(query.refName)
  readTafSlice(
    { text, blockIdAt },
    false,
    reader,
    sink,
    keepFor(query),
    (refSrc, start) => start >= query.end && onQueriedRefName(refSrc),
  )
}

export function countMaf(text: string, query: SliceQuery) {
  const sink = new CountingSink()
  readMaf(text, query, sink)
  return sink
}

export function countTaf(text: string, query: SliceQuery) {
  const sink = new CountingSink()
  readTaf(text, query, sink)
  return sink
}

export function recordMaf(text: string, query: SliceQuery) {
  const sink = new RecordingSink()
  readMaf(text, query, sink)
  return sink.lines.join('\n')
}

export function recordTaf(text: string, query: SliceQuery) {
  const sink = new RecordingSink()
  readTaf(text, query, sink)
  return sink.lines.join('\n')
}
