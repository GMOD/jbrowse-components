import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { revcom, revlist } from '@jbrowse/core/util'
import {
  convertCodingSequenceToPeptides,
  translExceptProteinPositions,
} from '@jbrowse/core/util/convertCodingSequenceToPeptides'
import {
  getGeneticCode,
  parseTranslTable,
  relativizeTranslExcept,
} from '@jbrowse/core/util/geneticCodes'
import { firstValueFrom, toArray } from 'rxjs'

import { dedupedSortedCDS } from './cdsSegments.ts'
import { hasCDSSubfeature, hasContainerChildren } from '../glyphs/glyphUtils.ts'
import { hasMatureProteinChildren } from '../glyphs/matureProteinRegion.ts'
import { getSubfeatures, isCDS } from '../util.ts'

import type { PeptideData } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region } from '@jbrowse/core/util'
import type { GeneticCode } from '@jbrowse/core/util/geneticCodes'

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

// Coding-transcript detection is structural, mirroring findGlyph: a feature with
// a direct CDS child is a coding transcript, so any type — mRNA, V_gene_segment,
// a prokaryotic gene → CDS, an org-specific type — is picked up without
// configuration. A feature whose children are themselves containers (gene →
// mRNA → exon) is descended into to reach its per-row transcripts; that check
// alone suffices, since a child only matches when it carries a CDS grandchild,
// which already makes the parent a container.
export function findTranscriptsWithCDS(
  features: Map<string, Feature>,
): Feature[] {
  const transcripts: Feature[] = []

  for (const feature of features.values()) {
    // Standalone polyprotein CDS (no gene/mRNA wrapper, e.g. a bare
    // CDS → mature_protein_region GFF): the CDS is itself the coding unit that
    // findGlyph routes to MatureProteinRegion, so it must translate as its own
    // single-segment transcript — dedupedSortedCDS returns its own span. Checked
    // first since its cleavage-product children satisfy none of the CDS-child
    // heuristics below.
    if (isCDS(feature) && hasMatureProteinChildren(feature)) {
      transcripts.push(feature)
    } else if (hasContainerChildren(feature)) {
      const matchingTranscripts =
        getSubfeatures(feature).filter(hasCDSSubfeature)
      if (matchingTranscripts.length > 0) {
        transcripts.push(...matchingTranscripts)
      } else if (hasCDSSubfeature(feature)) {
        transcripts.push(feature)
      }
    } else if (hasCDSSubfeature(feature)) {
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
  const cds = getSubfeatures(transcript).find(isCDS)
  return (
    parseTranslTable(transcript.get('transl_table')) ??
    parseTranslTable(cds?.get('transl_table')) ??
    assemblyGeneticCodeId
  )
}

// transl_except entries are carried on the CDS (NCBI convention), occasionally
// the transcript. Relativized to the strand-corrected CDS coordinate system so a
// selenocysteine reads as U etc., matching the feature-detail protein view.
function transcriptTranslExcept(transcript: Feature) {
  const cds = getSubfeatures(transcript).find(isCDS)
  const raw = transcript.get('transl_except') ?? cds?.get('transl_except')
  const start = transcript.get('start')
  return raw
    ? relativizeTranslExcept({
        raw,
        featureStart: start,
        featureLength: transcript.get('end') - start,
        strand: transcript.get('strand'),
      })
    : undefined
}

export function processTranscriptFromSeq(
  seq: string,
  transcript: Feature,
  code: GeneticCode,
): PeptideData | undefined {
  const strand = transcript.get('strand')
  const rawCds = extractCDSRegions(transcript)
  if (rawCds.length === 0) {
    return undefined
  }

  const processedSeq = strand === -1 ? revcom(seq) : seq
  const cds = strand === -1 ? revlist(rawCds, processedSeq.length) : rawCds
  const translExcept = transcriptTranslExcept(transcript)

  try {
    const protein = convertCodingSequenceToPeptides({
      cds,
      sequence: processedSeq,
      codonTable: code.codonTable,
      starts: code.starts,
      translExcept,
    })
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
  assemblyGeneticCodeId?: number,
): Promise<Map<string, PeptideData>> {
  const peptideDataMap = new Map<string, PeptideData>()

  const transcripts = findTranscriptsWithCDS(features)
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
    const code = getGeneticCode(
      transcriptGeneticCodeId(transcript, assemblyGeneticCodeId),
    )
    const peptideData = processTranscriptFromSeq(seq, transcript, code)
    if (peptideData) {
      peptideDataMap.set(transcript.id(), peptideData)
    }
  }

  return peptideDataMap
}
