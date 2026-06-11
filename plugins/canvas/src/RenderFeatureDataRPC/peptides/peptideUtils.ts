import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { codonTable, revcom, revlist } from '@jbrowse/core/util'
import { convertCodingSequenceToPeptides } from '@jbrowse/core/util/convertCodingSequenceToPeptides'
import { firstValueFrom, toArray } from 'rxjs'

import { hasCDSSubfeature } from '../glyphs/glyphUtils.ts'
import { isCDS } from '../util.ts'

import type { PeptideData } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export interface PeptideFetchProps {
  sessionId: string
  sequenceAdapter: Record<string, unknown>
  regions: (Region & { seqAdapterRefName?: string })[]
}

async function fetchSequence(
  pluginManager: PluginManager,
  props: PeptideFetchProps,
  region: Region & { seqAdapterRefName?: string },
) {
  const { sessionId, sequenceAdapter } = props
  try {
    const { dataAdapter } = await getAdapter(
      pluginManager,
      sessionId,
      sequenceAdapter,
    )

    const feats = await firstValueFrom(
      (dataAdapter as BaseFeatureDataAdapter)
        .getFeatures({
          ...region,
          refName: region.seqAdapterRefName ?? region.refName,
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

// Uses the same `transcriptTypes` list as the glyph layout (see findGlyph.ts).
// Threading the config through keeps peptide rendering and glyph layout from
// drifting — adding a SO term to the config picks it up in both places.
export function findTranscriptsWithCDS(
  features: Map<string, Feature>,
  transcriptTypes: readonly string[],
): Feature[] {
  const transcriptTypeSet = new Set(transcriptTypes)
  const isTranscriptType = (type: string | undefined) =>
    type !== undefined && transcriptTypeSet.has(type)
  const transcripts: Feature[] = []

  for (const feature of features.values()) {
    const type = feature.get('type')
    const subfeatures = feature.get('subfeatures')

    if (type === 'gene' && subfeatures?.length) {
      const matchingTranscripts = subfeatures.filter(
        (sf: Feature) =>
          isTranscriptType(sf.get('type')) && hasCDSSubfeature(sf),
      )
      if (matchingTranscripts.length > 0) {
        transcripts.push(...matchingTranscripts)
      } else if (hasCDSSubfeature(feature)) {
        transcripts.push(feature)
      }
    } else if (isTranscriptType(type) && hasCDSSubfeature(feature)) {
      transcripts.push(feature)
    }
  }

  return transcripts
}

function extractCDSRegions(feature: Feature) {
  const subfeatures = feature.get('subfeatures') ?? []
  const featureStart = feature.get('start')

  const regions = subfeatures
    .filter(sub => isCDS(sub) && sub.get('start') < sub.get('end'))
    .sort((a, b) => a.get('start') - b.get('start'))
    .map(sub => ({
      start: sub.get('start') - featureStart,
      end: sub.get('end') - featureStart,
      phase: sub.get('phase') ?? 0,
    }))

  // Dedupe CDS rows sharing start/end: GFF3 files (e.g. Gencode v36) can repeat
  // a CDS, which would otherwise stitch the duplicated bases into the translated
  // sequence and frameshift the protein. Matches the dedup in the g2p mapper so
  // the peptide string and the amino-acid rects stay index-aligned.
  return regions.filter(
    (r, i) =>
      i === 0 ||
      r.start !== regions[i - 1]!.start ||
      r.end !== regions[i - 1]!.end,
  )
}

export function processTranscriptFromSeq(
  seq: string,
  transcript: Feature,
): PeptideData | undefined {
  const strand = transcript.get('strand')
  const rawCds = extractCDSRegions(transcript)
  if (rawCds.length === 0) {
    return undefined
  }

  const processedSeq = strand === -1 ? revcom(seq) : seq
  const cds = strand === -1 ? revlist(rawCds, processedSeq.length) : rawCds

  try {
    const protein = convertCodingSequenceToPeptides({
      cds,
      sequence: processedSeq,
      codonTable,
    })
    return { protein }
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
  transcriptTypes: readonly string[],
): Promise<Map<string, PeptideData>> {
  const peptideDataMap = new Map<string, PeptideData>()

  const transcripts = findTranscriptsWithCDS(features, transcriptTypes)
  if (transcripts.length === 0) {
    return peptideDataMap
  }

  const baseRegion = props.regions[0]!
  const bulkStart = Math.max(
    0,
    Math.min(...transcripts.map(t => t.get('start'))),
  )
  const bulkEnd = Math.max(...transcripts.map(t => t.get('end')))

  const wholeSeq = await fetchSequence(pluginManager, props, {
    ...baseRegion,
    start: bulkStart,
    end: bulkEnd,
  })
  if (!wholeSeq) {
    return peptideDataMap
  }

  for (const transcript of transcripts) {
    const tStart = transcript.get('start')
    const tEnd = transcript.get('end')
    const seq = wholeSeq.slice(tStart - bulkStart, tEnd - bulkStart)
    const peptideData = processTranscriptFromSeq(seq, transcript)
    if (peptideData) {
      peptideDataMap.set(transcript.id(), peptideData)
    }
  }

  return peptideDataMap
}
