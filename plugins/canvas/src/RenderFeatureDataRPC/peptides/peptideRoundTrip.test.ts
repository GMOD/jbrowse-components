import { revcom } from '@jbrowse/core/util'
import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'

import { transcriptCDS } from '../collect/peptideMapping.ts'
import { aminoAcidsBySegment } from './aggregateAminoAcids.ts'
import { processTranscriptFromSeq } from './peptideUtils.ts'

import type { AggregatedAminoAcid } from './aggregateAminoAcids.ts'
import type { Feature } from '@jbrowse/core/util'

// Asserts end to end that the letter shown over a genomic span is the
// translation of the bases under that span. The other suites each check one half
// and neither notices when a phase or strand-order slip leaves both halves
// internally consistent with the letters on the wrong codons.
//
// Run across every strand × phase combination, because the translation reverses
// the segment list through revlist and the overlay reverses it through
// transcriptCDS — two reversals that must agree on which segment carries the
// phase, and on the - strand that is the HIGHEST-coordinate one.

const code = getGeneticCode(undefined)

function feat(opts: Record<string, unknown>): Feature {
  return {
    get: (k: string) => opts[k],
    id: () => 'tx',
  } as unknown as Feature
}

// Stepped so consecutive codons differ: a constant-base genome translates
// everything to one residue and passes however badly the mapping is shuffled.
const BASES = 'ACGT'
const genome = Array.from(
  { length: 400 },
  (_, i) => BASES[(i * 7 + (i % 5)) % 4]!,
).join('')

function cellBases(aa: AggregatedAminoAcid, strand: number) {
  const bases = genome.slice(aa.startBp, aa.endBp)
  return strand === -1 ? revcom(bases) : bases
}

// `firstExonLen` is the first exon IN TRANSCRIPTION ORDER, which on the -
// strand is the high-coordinate one.
function mapTranscript(strand: number, phase: number, firstExonLen = 11) {
  const low = { start: 100, end: 100 + firstExonLen }
  const high = { start: 211 - firstExonLen, end: 211 }
  const [firstExon, lastExon] = strand === -1 ? [high, low] : [low, high]
  const transcript = feat({
    type: 'mRNA',
    start: 100,
    end: 211,
    strand,
    subfeatures: [
      feat({ type: 'CDS', ...firstExon, phase }),
      feat({ type: 'CDS', ...lastExon, phase: 0 }),
    ],
  })
  const { protein } = processTranscriptFromSeq(
    genome.slice(100, 211),
    transcript,
    code,
  )!
  // Through transcriptCDS, the emitter's own ordering helper, so the reversal
  // under test is the shipped one rather than a copy.
  const bySegment = aminoAcidsBySegment(
    transcriptCDS(transcript, strand),
    protein,
    strand,
  )
  return [...bySegment.values()].flat()
}

describe.each([1, -1])('strand %i', strand => {
  test.each([0, 1, 2])(
    'phase %i: every whole codon draws the residue its own bases translate to',
    phase => {
      const cells = mapTranscript(strand, phase)
      const whole = cells.filter(aa => aa.endBp - aa.startBp === 3)
      // Guards against the filter emptying and the test asserting nothing.
      expect(whole.length).toBeGreaterThan(2)
      for (const aa of whole) {
        expect([aa.startBp, aa.aminoAcid]).toEqual([
          aa.startBp,
          code.codonTable[cellBases(aa, strand)],
        ])
      }
    },
  )

  // A codon split by an intron is two cells whose bases are not genomically
  // contiguous, and on the - strand the 5' piece is the one at the HIGHER
  // coordinate — concatenating in genomic order yields a different codon that
  // still translates to something.
  test.each([0, 1, 2])(
    'phase %i: a codon split by the intron stitches back',
    phase => {
      // There is only something to stitch when the intron lands mid-codon, and
      // the reading frame starts (3 - phase) % 3 bases in — so an 11bp first exon
      // ends exactly on a codon boundary at phase 2 and needs one extra base.
      const lead = (3 - phase) % 3
      const cells = mapTranscript(
        strand,
        phase,
        (lead + 11) % 3 === 0 ? 12 : 11,
      )
      const split = new Map<number, AggregatedAminoAcid[]>()
      for (const aa of cells) {
        if (aa.endBp - aa.startBp !== 3) {
          split.set(aa.proteinIndex, [
            ...(split.get(aa.proteinIndex) ?? []),
            aa,
          ])
        }
      }
      const straddling = [...split.values()].filter(
        pieces =>
          pieces.length === 2 &&
          pieces.reduce((n, p) => n + p.endBp - p.startBp, 0) === 3,
      )
      expect(straddling).toHaveLength(1)
      for (const pieces of straddling) {
        const codon = [...pieces]
          .sort((a, b) =>
            strand === -1 ? b.startBp - a.startBp : a.startBp - b.startBp,
          )
          .map(p => cellBases(p, strand))
          .join('')
        expect(pieces[0]!.aminoAcid).toBe(code.codonTable[codon])
      }
    },
  )
})
