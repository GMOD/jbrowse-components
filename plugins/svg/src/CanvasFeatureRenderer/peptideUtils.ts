import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { defaultCodonTable, generateCodonTable } from '@jbrowse/core/util'
import { convertCodingSequenceToPeptides } from '@jbrowse/core/util/convertCodingSequenceToPeptides'
import { firstValueFrom, toArray } from 'rxjs'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { Feature, Region } from '@jbrowse/core/util'

export interface SequenceData {
  seq: string
  cds: { start: number; end: number }[]
}

export interface PeptideData {
  sequenceData: SequenceData
  protein?: string
}

/**
 * Fetch sequence from a reference genome using the sequence adapter
 */
export async function fetchSequence(
  pluginManager: PluginManager,
  renderProps: RenderArgsDeserialized,
  region: Region,
): Promise<string | undefined> {
  const { sessionId, sequenceAdapter } = renderProps
  if (!sequenceAdapter) {
    console.warn('[fetchSequence] No sequenceAdapter provided')
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
          start: Math.max(0, region.start),
          end: region.end,
        })
        .pipe(toArray()),
    )
    const seq = feats[0]?.get('seq') as string | undefined
    return seq
  } catch (error) {
    console.warn('[fetchSequence] Failed to fetch sequence:', error)
    return undefined
  }
}

/**
 * Check if a feature type is a transcript type
 */
export function isTranscriptType(type: string): boolean {
  return (
    type === 'mRNA' ||
    type === 'transcript' ||
    type === 'primary_transcript' ||
    type === 'protein_coding_primary_transcript'
  )
}

/**
 * Check if a feature has CDS subfeatures
 */
export function hasCDSSubfeatures(feature: Feature): boolean {
  const subfeatures = feature.get('subfeatures')
  return subfeatures?.some((sub: Feature) => sub.get('type') === 'CDS') ?? false
}

/**
 * Find all transcript features with CDS subfeatures
 * Handles both direct transcript features and transcripts nested in genes
 */
export function findTranscriptsWithCDS(
  features: Map<string, Feature>,
): Feature[] {
  const transcripts: Feature[] = []

  for (const feature of features.values()) {
    const type = feature.get('type')
    const subfeatures = feature.get('subfeatures')

    // Check if this is a gene with transcript children
    if (type === 'gene' && subfeatures?.length) {
      for (const subfeature of subfeatures) {
        const subType = subfeature.get('type')
        if (isTranscriptType(subType) && hasCDSSubfeatures(subfeature)) {
          transcripts.push(subfeature)
        }
      }
    }
    // Check if this is a direct transcript with CDS
    else if (isTranscriptType(type) && hasCDSSubfeatures(feature)) {
      transcripts.push(feature)
    }
  }

  return transcripts
}

/**
 * Process feature subfeatures to extract CDS regions
 */
export function extractCDSRegions(
  feature: Feature,
): { start: number; end: number }[] {
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

/**
 * Fetch sequence and convert to peptides for a single transcript
 */
export async function fetchTranscriptPeptides(
  pluginManager: PluginManager,
  renderProps: RenderArgsDeserialized,
  transcript: Feature,
): Promise<PeptideData | undefined> {
  try {
    const region = {
      ...renderProps.regions[0]!,
      start: transcript.get('start'),
      end: transcript.get('end'),
      refName: transcript.get('refName'),
    }

    const seq = await fetchSequence(pluginManager, renderProps, region)
    if (!seq) {
      return undefined
    }

    const cds = extractCDSRegions(transcript)
    if (cds.length === 0) {
      return undefined
    }

    const sequenceData: SequenceData = { seq, cds }

    // Convert to peptides
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
      // Still return the sequence data even if peptide conversion failed
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

/**
 * Fetch peptide data for all features that need it
 */
export async function fetchPeptideData(
  pluginManager: PluginManager,
  renderProps: RenderArgsDeserialized,
  features: Map<string, Feature>,
): Promise<Map<string, PeptideData>> {
  const { colorByCDS, bpPerPx } = renderProps as any
  const peptideDataMap = new Map<string, PeptideData>()

  // Only fetch if colorByCDS is enabled and zoomed in enough
  const zoomedInEnough = 1 / bpPerPx >= 1
  if (!colorByCDS || !zoomedInEnough) {
    return peptideDataMap
  }

  // Find all transcripts with CDS subfeatures
  const transcriptsToFetch = findTranscriptsWithCDS(features)

  // Fetch sequences and convert to peptides for all transcripts
  for (const transcript of transcriptsToFetch) {
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
