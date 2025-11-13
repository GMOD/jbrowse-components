import { readConfObject } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { BoxRendererType } from '@jbrowse/core/pluggableElementTypes'
import {
  defaultCodonTable,
  generateCodonTable,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'
import { convertCodingSequenceToPeptides } from '@jbrowse/core/util/convertCodingSequenceToPeptides'
import { firstValueFrom, toArray } from 'rxjs'

import { computeLayouts } from './makeImageData'

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
  console.log(
    '[fetchSequence] sequenceAdapter:',
    sequenceAdapter,
    'region:',
    region,
  )
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
    console.log('[fetchSequence] Got dataAdapter:', dataAdapter)

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
    console.log('[fetchSequence] Fetched sequence length:', seq?.length)
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

    console.log(
      '[findTranscriptsWithCDS] Checking feature type:',
      type,
      'has subfeatures:',
      !!subfeatures?.length,
    )

    // Check if this is a gene with transcript children
    if (type === 'gene' && subfeatures?.length) {
      for (const subfeature of subfeatures) {
        const subType = subfeature.get('type')
        if (isTranscriptType(subType) && hasCDSSubfeatures(subfeature)) {
          console.log(
            '[findTranscriptsWithCDS] Found transcript in gene:',
            subfeature.id(),
            'type:',
            subType,
          )
          transcripts.push(subfeature)
        }
      }
    }
    // Check if this is a direct transcript with CDS
    else if (isTranscriptType(type) && hasCDSSubfeatures(feature)) {
      console.log(
        '[findTranscriptsWithCDS] Found direct transcript:',
        feature.id(),
        'type:',
        type,
      )
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

      console.log(
        '[fetchTranscriptPeptides] Stored peptide data for:',
        transcript.id(),
        'protein length:',
        protein.length,
      )
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
  const { colorByCDS, bpPerPx, exportSVG } = renderProps as any
  const peptideDataMap = new Map<string, PeptideData>()

  // Only fetch if colorByCDS is enabled and zoomed in enough
  const zoomedInEnough = 1 / bpPerPx >= 10
  console.log(
    '[fetchPeptideData] colorByCDS:',
    colorByCDS,
    'zoomedInEnough:',
    zoomedInEnough,
    'exportSVG:',
    exportSVG,
    'features:',
    features.size,
  )
  if (!colorByCDS || !zoomedInEnough) {
    console.log('[fetchPeptideData] Skipping: colorByCDS or zoom level not met')
    return peptideDataMap
  }

  // Find all transcripts with CDS subfeatures
  const transcriptsToFetch = findTranscriptsWithCDS(features)
  console.log(
    '[fetchPeptideData] Found',
    transcriptsToFetch.length,
    'transcripts to fetch',
  )

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

  console.log(
    '[fetchPeptideData] Returning peptideDataMap with',
    peptideDataMap.size,
    'entries',
  )
  return peptideDataMap
}

export default class CanvasFeatureRenderer extends BoxRendererType {
  supportsSVG = true

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const layout = this.createLayoutInWorker(renderProps)
    const { statusCallback = () => {}, regions, bpPerPx, config } = renderProps
    const region = regions[0]!
    const width = Math.max(1, (region.end - region.start) / bpPerPx)

    // Compute layouts for all features
    const layoutRecords = await updateStatus(
      'Computing feature layout',
      statusCallback as (arg: string) => void,
      () => {
        return computeLayouts({
          features,
          bpPerPx,
          region,
          config,
          layout,
        })
      },
    )

    const height = Math.max(1, layout.getTotalHeight())

    // Fetch peptide data for CDS features
    const peptideDataMap = await updateStatus(
      'Fetching peptide data',
      statusCallback as (arg: string) => void,
      () => fetchPeptideData(this.pluginManager, renderProps, features),
    )

    // Render to canvas
    const res = await updateStatus(
      'Rendering features',
      statusCallback as (arg: string) => void,
      async () => {
        const { makeImageData } = await import('./makeImageData')
        const displayMode = readConfObject(config, 'displayMode') as string

        return renderToAbstractCanvas(width, height, renderProps, ctx =>
          makeImageData({
            ctx,
            layoutRecords,
            renderArgs: {
              ...renderProps,
              features,
              layout,
              displayMode,
              peptideDataMap,
              colorByCDS: (renderProps as any).colorByCDS,
            },
          }),
        )
      },
    )

    const result = await super.render({
      ...renderProps,
      ...res,
      layout,
      height,
      width,
    })

    return {
      ...result,
      ...res,
      layout,
      height,
      width,
      maxHeightReached: layout.maxHeightReached,
      containsNoTransferables: true,
    }
  }
}
