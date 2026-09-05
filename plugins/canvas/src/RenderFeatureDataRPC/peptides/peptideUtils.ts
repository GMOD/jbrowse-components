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

import { hasCDSSubfeature } from '../glyphs/glyphUtils.ts'
import {
  collectPolyproteinCDS,
  hasMatureProteinChildren,
} from '../glyphs/matureProteinRegion.ts'
import { getSubfeatures, isCDS } from '../util.ts'
import { dedupedSortedCDS } from './cdsSegments.ts'

import type { PeptideData } from '../types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region } from '@jbrowse/core/util'
import type { GeneticCode } from '@jbrowse/core/util/geneticCodes'

interface PeptideFetchProps {
  sessionId: string
  sequenceAdapter: Record<string, unknown>
  regions: (Region & { originalRefName?: string })[]
}

// Below this gap, reading straight through an intron costs less than a second
// request for the exon on the far side.
const MERGE_GAP_BP = 5000

// Round-trip ceiling per region, so a 79-exon gene with megabase introns can't
// become 79 requests. Merging always closes the smallest gap first, making the
// bases the cap costs the cheapest ones on offer.
const MAX_SEQUENCE_RANGES = 12

interface BpRange {
  start: number
  end: number
}

function mergeSequenceRanges(ranges: BpRange[]) {
  const merged: BpRange[] = []
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1)
    if (last && range.start - last.end < MERGE_GAP_BP) {
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ start: range.start, end: range.end })
    }
  }
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

// A single buffer spanning [bufferStart, bufferEnd) carrying real bases inside
// the fetched ranges and N everywhere else. The N never reaches a codon: the
// ranges are the same dedupedSortedCDS segments the translation reads, and
// nothing downstream looks at an intron or a UTR. Undefined when any range
// failed, so a partial buffer can never translate into wrong residues.
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

// Coding-transcript detection is structural, mirroring findGlyph: a feature with
// a direct CDS child is a coding transcript, so any type — mRNA, V_gene_segment,
// a prokaryotic gene → CDS, an org-specific type — is picked up without
// configuration. A feature whose children are coding transcripts (gene → mRNA →
// CDS) is descended into to reach them instead.
//
// The descent needs no container test of its own. It used to be guarded by
// hasContainerChildren, which cannot ever change the answer: a child that
// carries a CDS grandchild has subfeatures, which is what makes its parent a
// container. Asking directly for the coding children is the same question with
// one branch, and it leaves ONE place that decides a feature is itself the
// transcript instead of two identical ones.
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
      continue
    }
    // A wrapped polyprotein translates per CDS, not at the wrapper. A polyprotein
    // CDS satisfies neither hasCDSSubfeature (its children are cleavage products,
    // not CDS) nor the container descent, so the old fallback keyed the whole
    // gene — and dedupedSortedCDS then stitched every CDS child into one ORF. For
    // SARS-CoV-2, whose ORF1ab gene carries both pp1ab and the overlapping pp1a,
    // that produced an 11502-aa concatenation in place of the real 7096-aa
    // protein, and every mature region in the shared span drew residues from both.
    const polyproteins = collectPolyproteinCDS(feature)
    if (polyproteins.length > 0) {
      transcripts.push(...polyproteins)
      continue
    }
    const codingChildren = getSubfeatures(feature).filter(hasCDSSubfeature)
    if (codingChildren.length > 0) {
      transcripts.push(...codingChildren)
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
  // refName. The transcripts therefore share one coordinate frame, and one
  // buffer spanning all of them (rather than one fetch per transcript) avoids N
  // round trips.
  //
  // Only CDS bases are ever translated, so the buffer is filled from the coding
  // stretches rather than the whole span: DMD spans 2.2Mb around 11kb of CDS,
  // and fetching the span downloaded and decompressed every intron to read none
  // of it.
  const bulkStart = Math.max(
    0,
    Math.min(...transcripts.map(t => t.get('start'))),
  )
  const bulkEnd = Math.max(...transcripts.map(t => t.get('end')))

  const wholeSeq = await fetchCodingSequenceBuffer(
    pluginManager,
    props,
    mergeSequenceRanges(transcripts.flatMap(t => dedupedSortedCDS(t))),
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
