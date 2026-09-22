import { convertCodingSequenceToPeptides } from './convertCodingSequenceToPeptides.ts'
import {
  getGeneticCode,
  parseTranslTable,
  relativizeTranslExcept,
} from './geneticCodes.ts'
import { revlist } from './revlist.ts'
import { revcom } from './seqUtils.ts'

import type { TranslExcept } from './geneticCodes.ts'
import type { Feature } from './simpleFeature.ts'

export interface CdsSegment {
  start: number
  end: number
  phase: number
}

function isCDS(feature: Feature) {
  return feature.get('type')?.toLowerCase() === 'cds'
}

function subfeatures(feature: Feature): Feature[] {
  return feature.get('subfeatures') ?? []
}

/**
 * A transcript's CDS segments in genome coordinates, sorted and deduplicated. A
 * GFF3 file can repeat a CDS row, and the duplicated bases would stitch into
 * the translation and frameshift the protein. A standalone polyprotein CDS
 * carries cleavage products rather than CDS children, so its own span is the
 * one segment.
 */
export function transcriptCDS(transcript: Feature): CdsSegment[] {
  const seen = new Set<string>()
  const cds: CdsSegment[] = []
  const sorted = subfeatures(transcript).toSorted(
    (a, b) => a.get('start') - b.get('start'),
  )
  for (const sub of sorted) {
    const start = sub.get('start')
    const end = sub.get('end')
    const key = `${start}-${end}`
    if (isCDS(sub) && start < end && !seen.has(key)) {
      seen.add(key)
      cds.push({ start, end, phase: sub.get('phase') ?? 0 })
    }
  }
  if (cds.length === 0 && isCDS(transcript)) {
    const start = transcript.get('start')
    const end = transcript.get('end')
    if (start < end) {
      cds.push({ start, end, phase: transcript.get('phase') ?? 0 })
    }
  }
  return cds
}

/**
 * The genetic code a transcript translates with: a `transl_table` on it or on
 * its CDS, else the assembly's code for its contig, else undefined for the
 * standard code.
 */
export function transcriptGeneticCodeId(
  transcript: Feature,
  assemblyGeneticCodeId?: number,
) {
  const cds = subfeatures(transcript).find(isCDS)
  return (
    parseTranslTable(transcript.get('transl_table')) ??
    parseTranslTable(cds?.get('transl_table')) ??
    assemblyGeneticCodeId
  )
}

/**
 * A transcript's `transl_except` overrides (RefSeq's selenocysteines), read off
 * the CDS by NCBI convention or the transcript itself, in the transcript-
 * relative, strand-corrected frame `translateTranscript` translates in.
 */
export function transcriptTranslExcept(transcript: Feature) {
  const cds = subfeatures(transcript).find(isCDS)
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

/**
 * A transcript's protein as JBrowse shows it: its CDS stitched in order, read
 * with its genetic code and that code's alternative initiators, with any
 * `transl_except` applied. `seq` is the genome under the transcript, its start
 * to its end. Undefined for a transcript with no CDS. `cds` and `translExcept`
 * are the transcript-relative, strand-corrected frame the protein was read in,
 * for a caller placing residues back on it.
 */
export function translateTranscript({
  transcript,
  seq,
  assemblyGeneticCodeId,
}: {
  transcript: Feature
  seq: string
  assemblyGeneticCodeId?: number
}):
  | { protein: string; cds: CdsSegment[]; translExcept?: TranslExcept[] }
  | undefined {
  const start = transcript.get('start')
  const relative = transcriptCDS(transcript).map(c => ({
    ...c,
    start: c.start - start,
    end: c.end - start,
  }))
  if (relative.length === 0) {
    return undefined
  }
  const minus = transcript.get('strand') === -1
  const cds = minus ? revlist(relative, seq.length) : relative
  const translExcept = transcriptTranslExcept(transcript)
  const { codonTable, starts } = getGeneticCode(
    transcriptGeneticCodeId(transcript, assemblyGeneticCodeId),
  )
  return {
    protein: convertCodingSequenceToPeptides({
      cds,
      sequence: minus ? revcom(seq) : seq,
      codonTable,
      starts,
      translExcept,
    }),
    cds,
    translExcept,
  }
}
