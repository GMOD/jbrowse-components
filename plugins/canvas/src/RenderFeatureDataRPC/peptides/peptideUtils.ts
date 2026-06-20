import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { revcom, revlist } from '@jbrowse/core/util'
import { convertCodingSequenceToPeptides } from '@jbrowse/core/util/convertCodingSequenceToPeptides'
import {
  getGeneticCode,
  parseTranslTable,
} from '@jbrowse/core/util/geneticCodes'
import { firstValueFrom, toArray } from 'rxjs'

import { dedupedSortedCDS } from './cdsSegments.ts'
import { hasCDSSubfeature } from '../glyphs/glyphUtils.ts'
import { isCDS } from '../util.ts'

import type { PeptideData } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

export interface PeptideFetchProps {
  sessionId: string
  sequenceAdapter: Record<string, unknown>
  regions: (Region & { originalRefName?: string })[]
}

async function fetchSequence(
  pluginManager: PluginManager,
  props: PeptideFetchProps,
  region: Region & { originalRefName?: string },
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

// Feature-relative CDS segments for translation. dedupedSortedCDS supplies the
// absolute, ascending, frameshift-guarded segments (shared with the amino-acid
// overlay); we only subtract featureStart to make them relative to the sequence
// slice handed to the codon translator.
function extractCDSRegions(feature: Feature) {
  const featureStart = feature.get('start')
  return dedupedSortedCDS(feature).map(({ start, end, phase }) => ({
    start: start - featureStart,
    end: end - featureStart,
    phase: phase ?? 0,
  }))
}

// NCBI translation table for a transcript: `transl_table` is carried on the CDS
// (e.g. mitochondrial = 2), occasionally on the transcript itself. When the
// features carry no transl_table (e.g. UCSC genePred-derived GFFs), fall back to
// the assembly-configured code for the contig (assemblyGeneticCodeId). Undefined
// falls back to the standard code, preserving prior behavior for unannotated
// data.
export function transcriptGeneticCodeId(
  transcript: Feature,
  assemblyGeneticCodeId: number | undefined,
) {
  const cds = (transcript.get('subfeatures') ?? []).find(f => isCDS(f))
  return (
    parseTranslTable(transcript.get('transl_table')) ??
    parseTranslTable(cds?.get('transl_table')) ??
    assemblyGeneticCodeId
  )
}

export function processTranscriptFromSeq(
  seq: string,
  transcript: Feature,
  codonTable: Record<string, string>,
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
  assemblyGeneticCodeId?: number,
): Promise<Map<string, PeptideData>> {
  const peptideDataMap = new Map<string, PeptideData>()

  const transcripts = findTranscriptsWithCDS(features, transcriptTypes)
  if (transcripts.length === 0) {
    return peptideDataMap
  }

  // RenderFeatureData runs per-region, so props.regions is single-element and
  // every transcript here was fetched from that region — they all share its
  // refName. One bulk sequence fetch spanning all transcripts (rather than one
  // per transcript) is therefore safe and avoids N round trips.
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
    const { codonTable } = getGeneticCode(
      transcriptGeneticCodeId(transcript, assemblyGeneticCodeId),
    )
    const peptideData = processTranscriptFromSeq(seq, transcript, codonTable)
    if (peptideData) {
      peptideDataMap.set(transcript.id(), peptideData)
    }
  }

  return peptideDataMap
}
