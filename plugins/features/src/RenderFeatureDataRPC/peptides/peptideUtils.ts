import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { mergeIntervals } from '@jbrowse/core/util'
import { translExceptProteinPositions } from '@jbrowse/core/util/convertCodingSequenceToPeptides'
import {
  transcriptCDS,
  translateTranscript,
} from '@jbrowse/core/util/translateTranscript'
import { firstValueFrom, toArray } from 'rxjs'

import { peptideTargets } from '../glyphs/findGlyph.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { PeptideData } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region } from '@jbrowse/core/util'

interface PeptideFetchProps {
  sessionId: string
  sequenceAdapter: Record<string, unknown>
  regions: (Region & { originalRefName?: string })[]
}

// Below this gap, reading straight through an intron costs less than a second
// request for the exon on the far side.
const MERGE_GAP_BP = 5000

// A round-trip ceiling per region, so a 79-exon gene with megabase introns
// cannot become 79 requests. Merging closes the smallest gap first, so the bases
// the cap costs are the cheapest ones on offer.
const MAX_SEQUENCE_RANGES = 12

interface BpRange {
  start: number
  end: number
}

function mergeSequenceRanges(ranges: BpRange[]) {
  const merged = mergeIntervals(ranges, MERGE_GAP_BP / 2)
  const gapBefore = (i: number) => merged[i]!.start - merged[i - 1]!.end
  while (merged.length > MAX_SEQUENCE_RANGES) {
    let smallest = 1
    for (let i = 2; i < merged.length; i++) {
      if (gapBefore(i) < gapBefore(smallest)) {
        smallest = i
      }
    }
    merged[smallest - 1]!.end = merged[smallest]!.end
    merged.splice(smallest, 1)
  }
  return merged
}

// One buffer spanning [bufferStart, bufferEnd) with real bases inside the
// fetched ranges and N everywhere else. The N never reaches a codon, since the
// ranges are the same segments the translation reads. Undefined when any range
// failed, so a partial buffer cannot translate into wrong residues.
async function fetchCodingSequenceBuffer(
  pluginManager: PluginManager,
  props: PeptideFetchProps,
  ranges: BpRange[],
  bufferStart: number,
  bufferEnd: number,
) {
  const baseRegion = props.regions[0]!
  const fetched = await Promise.all(
    ranges.map(async range => ({
      start: range.start,
      seq: await fetchSequence(pluginManager, props, {
        ...baseRegion,
        ...range,
      }),
    })),
  )
  const pieces: string[] = []
  let cursor = bufferStart
  for (const { start, seq } of fetched) {
    if (seq === undefined) {
      return undefined
    }
    pieces.push('N'.repeat(Math.max(0, start - cursor)), seq)
    cursor = Math.max(cursor, start + seq.length)
  }
  pieces.push('N'.repeat(Math.max(0, bufferEnd - cursor)))
  return pieces.join('')
}

async function fetchSequence(
  pluginManager: PluginManager,
  props: PeptideFetchProps,
  region: Region & { originalRefName?: string },
) {
  const { sessionId, sequenceAdapter } = props
  try {
    const dataAdapter = await getFeatureAdapterOrThrow({
      pluginManager,
      sessionId,
      adapterConfig: sequenceAdapter,
    })

    const feats = await firstValueFrom(
      dataAdapter
        .getFeatures({
          ...region,
          refName: region.originalRefName ?? region.refName,
          start: Math.max(0, region.start),
        })
        .pipe(toArray()),
    )
    return feats[0]?.get('seq') as string | undefined
  } catch (error) {
    console.warn('[fetchSequence] Failed to fetch sequence:', error)
    return undefined
  }
}

export function processTranscriptFromSeq(
  seq: string,
  transcript: Feature,
  assemblyGeneticCodeId?: number,
): PeptideData | undefined {
  try {
    const translation = translateTranscript({
      transcript,
      seq,
      assemblyGeneticCodeId,
    })
    if (!translation) {
      return undefined
    }
    const { protein, cds, translExcept } = translation
    return {
      protein,
      translExceptIndices: translExcept?.length
        ? translExceptProteinPositions({ cds, translExcept })
        : undefined,
    }
  } catch (error) {
    console.warn(
      `[processTranscriptFromSeq] Failed to convert sequence to peptides for ${transcript.id()}:`,
      error,
    )
    return undefined
  }
}

export async function fetchPeptideData(
  pluginManager: PluginManager,
  props: PeptideFetchProps,
  features: Map<string, Feature>,
  config: DisplayConfig,
  assemblyGeneticCodeId?: number,
): Promise<Map<string, PeptideData>> {
  const peptideDataMap = new Map<string, PeptideData>()

  const transcripts = [...features.values()].flatMap(f =>
    peptideTargets(f, config),
  )
  if (transcripts.length === 0) {
    return peptideDataMap
  }

  // Every transcript came from the single region this RPC call runs over, so
  // they share one coordinate frame and one buffer spanning all of them replaces
  // N round trips. Only CDS bases translate, so the buffer is filled from the
  // coding stretches — DMD spans 2.2Mb around 11kb of CDS.
  const bulkStart = Math.max(
    0,
    Math.min(...transcripts.map(t => t.get('start'))),
  )
  const bulkEnd = Math.max(...transcripts.map(t => t.get('end')))

  const wholeSeq = await fetchCodingSequenceBuffer(
    pluginManager,
    props,
    mergeSequenceRanges(transcripts.flatMap(t => transcriptCDS(t))),
    bulkStart,
    bulkEnd,
  )
  if (!wholeSeq) {
    return peptideDataMap
  }

  for (const transcript of transcripts) {
    const tStart = transcript.get('start')
    const tEnd = transcript.get('end')
    const seq = wholeSeq.slice(tStart - bulkStart, tEnd - bulkStart)
    const peptideData = processTranscriptFromSeq(
      seq,
      transcript,
      assemblyGeneticCodeId,
    )
    if (peptideData) {
      peptideDataMap.set(transcript.id(), peptideData)
    }
  }

  return peptideDataMap
}
