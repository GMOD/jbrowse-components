import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  defaultCodonTable,
  generateCodonTable,
  revcom,
} from '@jbrowse/core/util'
import { convertCodingSequenceToPeptides } from '@jbrowse/core/util/convertCodingSequenceToPeptides'
import { firstValueFrom, toArray } from 'rxjs'

import { shouldRenderPeptideBackground } from '../zoomThresholds.ts'

import type { PeptideData, SequenceData } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { Feature, Region } from '@jbrowse/core/util'

type RegionWithSeqAdapter = Region & { seqAdapterRefName?: string }

async function fetchSequence(
  pluginManager: PluginManager,
  renderProps: RenderArgsDeserialized,
  region: RegionWithSeqAdapter,
) {
  const { sessionId, sequenceAdapter } = renderProps as {
    sessionId: string
    sequenceAdapter?: Record<string, unknown>
  }
  if (!sequenceAdapter) {
    return undefined
  }
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

function isTranscriptType(
  type: string,
  transcriptTypes = DEFAULT_TRANSCRIPT_TYPES,
) {
  return transcriptTypes.includes(type)
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
      // Check for transcript children with CDS (gene->mRNA->CDS)
      let hasTranscriptWithCDS = false
      for (const subfeature of subfeatures) {
        const subType = subfeature.get('type')
        if (isTranscriptType(subType) && hasCDSSubfeatures(subfeature)) {
          transcripts.push(subfeature)
          hasTranscriptWithCDS = true
        }
      }
      // If no transcript children with CDS, check for direct CDS children
      // (gene->CDS hierarchy)
      if (!hasTranscriptWithCDS && hasCDSSubfeatures(feature)) {
        transcripts.push(feature)
      }
    } else if (isTranscriptType(type) && hasCDSSubfeatures(feature)) {
      transcripts.push(feature)
    }
  }

  return transcripts
}

function extractCDSRegions(feature: Feature): { start: number; end: number }[] {
  const subfeatures = feature.get('subfeatures') || []
  const featureStart = feature.get('start')

  return subfeatures
    .filter((sub: Feature) => sub.get('type') === 'CDS')
    .sort((a: Feature, b: Feature) => a.get('start') - b.get('start'))
    .map((sub: Feature) => ({
      start: sub.get('start') - featureStart,
      end: sub.get('end') - featureStart,
    }))
}

async function fetchTranscriptPeptides(
  pluginManager: PluginManager,
  renderProps: RenderArgsDeserialized,
  transcript: Feature,
): Promise<PeptideData | undefined> {
  try {
    const baseRegion = renderProps.regions[0] as RegionWithSeqAdapter
    const region = {
      ...baseRegion,
      start: transcript.get('start'),
      end: transcript.get('end'),
    }

    let seq = await fetchSequence(pluginManager, renderProps, region)
    if (!seq) {
      return undefined
    }

    const strand = transcript.get('strand') as number
    let cds = extractCDSRegions(transcript)
    if (cds.length === 0) {
      return undefined
    }

    if (strand === -1) {
      seq = revcom(seq)
      const seqLen = seq.length
      cds = cds
        .map(region => ({
          start: seqLen - region.end,
          end: seqLen - region.start,
        }))
        .reverse()
    }

    const sequenceData: SequenceData = { seq, cds }

    try {
      const protein = convertCodingSequenceToPeptides({
        cds,
        sequence: seq,
        codonTable: generateCodonTable(defaultCodonTable),
      })

      return { sequenceData, protein }
    } catch (error) {
      console.warn(
        `[fetchTranscriptPeptides] Failed to convert sequence to peptides for ${transcript.id()}:`,
        error,
      )
      return { sequenceData }
    }
  } catch (error) {
    console.warn(
      `[fetchTranscriptPeptides] Failed to fetch sequence for transcript ${transcript.id()}:`,
      error,
    )
    return undefined
  }
}

export async function fetchPeptideData(
  pluginManager: PluginManager,
  renderProps: RenderArgsDeserialized,
  features: Map<string, Feature>,
): Promise<Map<string, PeptideData>> {
  const { colorByCDS, bpPerPx } = renderProps as {
    colorByCDS?: boolean
    bpPerPx: number
  }
  const peptideDataMap = new Map<string, PeptideData>()
  if (!colorByCDS || !shouldRenderPeptideBackground(bpPerPx)) {
    return peptideDataMap
  }

  for (const transcript of findTranscriptsWithCDS(features)) {
    const peptideData = await fetchTranscriptPeptides(
      pluginManager,
      renderProps,
      transcript,
    )
    if (peptideData) {
      peptideDataMap.set(transcript.id(), peptideData)
    }
  }

  return peptideDataMap
}
