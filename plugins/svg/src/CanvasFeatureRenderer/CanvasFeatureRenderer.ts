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

import { computeLayouts } from './makeImageData'

import type { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'
import { firstValueFrom, toArray } from 'rxjs'

interface SequenceData {
  seq: string
  cds: Array<{ start: number; end: number }>
}

interface PeptideData {
  sequenceData: SequenceData
  protein?: string
}

export default class CanvasFeatureRenderer extends BoxRendererType {
  supportsSVG = true

  async fetchSequence(
    renderProps: RenderArgsDeserialized,
    region: Region,
  ): Promise<string | undefined> {
    const { sessionId, sequenceAdapter } = renderProps
    console.log('[CanvasFeatureRenderer.fetchSequence] sequenceAdapter:', sequenceAdapter, 'region:', region)
    if (!sequenceAdapter) {
      console.warn('[CanvasFeatureRenderer.fetchSequence] No sequenceAdapter provided')
      return undefined
    }
    try {
      const { dataAdapter } = await getAdapter(
        this.pluginManager,
        sessionId,
        sequenceAdapter,
      )
      console.log('[CanvasFeatureRenderer.fetchSequence] Got dataAdapter:', dataAdapter)

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
      console.log('[CanvasFeatureRenderer.fetchSequence] Fetched sequence length:', seq?.length)
      return seq
    } catch (error) {
      console.warn('[CanvasFeatureRenderer.fetchSequence] Failed to fetch sequence:', error)
      return undefined
    }
  }

  /**
   * Process feature subfeatures to extract CDS regions
   */
  private extractCDSRegions(
    feature: Feature,
  ): Array<{ start: number; end: number }> {
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
   * Fetch peptide data for all features that need it
   */
  async fetchPeptideData(
    renderProps: RenderArgsDeserialized,
    features: Map<string, Feature>,
  ): Promise<Map<string, PeptideData>> {
    const { colorByCDS, bpPerPx, exportSVG } = renderProps as any
    const peptideDataMap = new Map<string, PeptideData>()

    // Only fetch if colorByCDS is enabled and zoomed in enough
    const zoomedInEnough = 1 / bpPerPx >= 10
    console.log('[CanvasFeatureRenderer.fetchPeptideData] colorByCDS:', colorByCDS, 'zoomedInEnough:', zoomedInEnough, 'exportSVG:', exportSVG, 'features:', features.size)
    if (!colorByCDS || !zoomedInEnough) {
      console.log('[CanvasFeatureRenderer.fetchPeptideData] Skipping: colorByCDS or zoom level not met')
      return peptideDataMap
    }

    // Find all features that are transcripts with CDS subfeatures
    const transcriptsToFetch: Feature[] = []
    for (const feature of features.values()) {
      const type = feature.get('type')
      const subfeatures = feature.get('subfeatures')

      console.log('[CanvasFeatureRenderer.fetchPeptideData] Checking feature type:', type, 'has subfeatures:', !!subfeatures?.length)

      // Check if this is a gene with transcript children
      if (type === 'gene' && subfeatures?.length) {
        for (const subfeature of subfeatures) {
          const subType = subfeature.get('type')
          const subSubfeatures = subfeature.get('subfeatures')

          if (
            (subType === 'mRNA' ||
              subType === 'transcript' ||
              subType === 'primary_transcript' ||
              subType === 'protein_coding_primary_transcript') &&
            subSubfeatures?.length
          ) {
            const hasCDS = subSubfeatures.some(
              (sub: Feature) => sub.get('type') === 'CDS',
            )
            if (hasCDS) {
              console.log('[CanvasFeatureRenderer.fetchPeptideData] Found transcript in gene:', subfeature.id(), 'type:', subType)
              transcriptsToFetch.push(subfeature)
            }
          }
        }
      }
      // Check if this is a direct transcript with CDS
      else if (
        subfeatures?.length &&
        (type === 'mRNA' ||
          type === 'transcript' ||
          type === 'primary_transcript' ||
          type === 'protein_coding_primary_transcript')
      ) {
        const hasCDS = subfeatures.some(
          (sub: Feature) => sub.get('type') === 'CDS',
        )
        if (hasCDS) {
          console.log('[CanvasFeatureRenderer.fetchPeptideData] Found direct transcript:', feature.id(), 'type:', type)
          transcriptsToFetch.push(feature)
        }
      }
    }
    console.log('[CanvasFeatureRenderer.fetchPeptideData] Found', transcriptsToFetch.length, 'transcripts to fetch')

    // Fetch sequences for all transcripts
    for (const transcript of transcriptsToFetch) {
      try {
        const region = {
          ...renderProps.regions[0]!,
          start: transcript.get('start'),
          end: transcript.get('end'),
          refName: transcript.get('refName'),
        }

        const seq = await this.fetchSequence(renderProps, region)
        if (seq) {
          const cds = this.extractCDSRegions(transcript)

          if (cds.length > 0) {
            const sequenceData: SequenceData = { seq, cds }

            // Convert to peptides
            try {
              const protein = convertCodingSequenceToPeptides({
                cds,
                sequence: seq,
                codonTable: generateCodonTable(defaultCodonTable),
              })

              peptideDataMap.set(transcript.id(), {
                sequenceData,
                protein,
              })
              console.log('[CanvasFeatureRenderer.fetchPeptideData] Stored peptide data for:', transcript.id(), 'protein length:', protein.length)
            } catch (error) {
              console.warn(
                `[CanvasFeatureRenderer.fetchPeptideData] Failed to convert sequence to peptides for ${transcript.id()}:`,
                error,
              )
              // Still store the sequence data even if peptide conversion failed
              peptideDataMap.set(transcript.id(), { sequenceData })
            }
          }
        }
      } catch (error) {
        console.warn(
          `[CanvasFeatureRenderer.fetchPeptideData] Failed to fetch sequence for transcript ${transcript.id()}:`,
          error,
        )
      }
    }

    console.log('[CanvasFeatureRenderer.fetchPeptideData] Returning peptideDataMap with', peptideDataMap.size, 'entries')
    return peptideDataMap
  }

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
      () => this.fetchPeptideData(renderProps, features),
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
