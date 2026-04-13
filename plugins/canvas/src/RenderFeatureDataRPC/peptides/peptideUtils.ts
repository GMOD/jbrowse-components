import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  defaultCodonTable,
  generateCodonTable,
  revcom,
} from '@jbrowse/core/util'
import { convertCodingSequenceToPeptides } from '@jbrowse/core/util/convertCodingSequenceToPeptides'
import { firstValueFrom, toArray } from 'rxjs'

import type { PeptideData } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

const codonTable = generateCodonTable(defaultCodonTable)

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

const DEFAULT_TRANSCRIPT_TYPES = [
  'mRNA',
  'transcript',
  'primary_transcript',
  'protein_coding_primary_transcript',
]

function isTranscriptType(type: string) {
  return DEFAULT_TRANSCRIPT_TYPES.includes(type)
}

function hasCDSSubfeatures(feature: Feature) {
  const subfeatures = feature.get('subfeatures')
  return subfeatures?.some((sub: Feature) => sub.get('type') === 'CDS') ?? false
}

export function findTranscriptsWithCDS(
  features: Map<string, Feature>,
): Feature[] {
  const transcripts: Feature[] = []

  for (const feature of features.values()) {
    const type = feature.get('type')
    const subfeatures = feature.get('subfeatures')

    if (type === 'gene' && subfeatures?.length) {
      let hasTranscriptWithCDS = false
      for (const subfeature of subfeatures) {
        const subType = subfeature.get('type') ?? ''
        if (isTranscriptType(subType) && hasCDSSubfeatures(subfeature)) {
          transcripts.push(subfeature)
          hasTranscriptWithCDS = true
        }
      }
      if (!hasTranscriptWithCDS && hasCDSSubfeatures(feature)) {
        transcripts.push(feature)
      }
    } else if (isTranscriptType(type ?? '') && hasCDSSubfeatures(feature)) {
      transcripts.push(feature)
    }
  }

  return transcripts
}

function extractCDSRegions(feature: Feature) {
  const subfeatures = feature.get('subfeatures') ?? []
  const featureStart = feature.get('start')

  return subfeatures
    .filter((sub: Feature) => sub.get('type') === 'CDS')
    .sort((a: Feature, b: Feature) => a.get('start') - b.get('start'))
    .map((sub: Feature) => ({
      start: sub.get('start') - featureStart,
      end: sub.get('end') - featureStart,
      phase: (sub.get('phase') as number | undefined) ?? 0,
    }))
}

function processTranscriptFromSeq(
  seq: string,
  transcript: Feature,
): PeptideData | undefined {
  const strand = transcript.get('strand')
  let cds = extractCDSRegions(transcript)
  if (cds.length === 0) {
    return undefined
  }

  let processedSeq = seq
  if (strand === -1) {
    processedSeq = revcom(seq)
    const seqLen = processedSeq.length
    cds = cds
      .map(r => ({
        ...r,
        start: seqLen - r.end,
        end: seqLen - r.start,
      }))
      .reverse()
  }

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
): Promise<Map<string, PeptideData>> {
  const peptideDataMap = new Map<string, PeptideData>()

  const transcripts = findTranscriptsWithCDS(features)
  if (transcripts.length === 0) {
    return peptideDataMap
  }

  const baseRegion = props.regions[0]!
  const bulkStart = Math.max(
    0,
    Math.min(...transcripts.map(t => t.get('start') as number)),
  )
  const bulkEnd = Math.max(...transcripts.map(t => t.get('end') as number))

  const wholeSeq = await fetchSequence(pluginManager, props, {
    ...baseRegion,
    start: bulkStart,
    end: bulkEnd,
  })
  if (!wholeSeq) {
    return peptideDataMap
  }

  for (const transcript of transcripts) {
    const tStart = transcript.get('start') as number
    const tEnd = transcript.get('end') as number
    const seq = wholeSeq.slice(tStart - bulkStart, tEnd - bulkStart)
    const peptideData = processTranscriptFromSeq(seq, transcript)
    if (peptideData) {
      peptideDataMap.set(transcript.id(), peptideData)
    }
  }

  return peptideDataMap
}
