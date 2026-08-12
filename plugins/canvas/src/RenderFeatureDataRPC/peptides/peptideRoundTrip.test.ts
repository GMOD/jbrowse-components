import { revcom } from '@jbrowse/core/util'
import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'

import { transcriptCDS } from '../collect/peptideMapping.ts'
import { aminoAcidsBySegment } from './aggregateAminoAcids.ts'
import { processTranscriptFromSeq } from './peptideUtils.ts'

import type { AggregatedAminoAcid } from './aggregateAminoAcids.ts'
import type { Feature } from '@jbrowse/core/util'

// The invariant the whole peptide pipeline exists to hold, asserted end to end:
// the letter shown over a genomic span is the translation of the bases under
// that span.
//
// Every other test here checks one half — that a CDS translates to the right
// protein string (peptideUtils), or that a protein string maps onto the right
// genomic spans (aggregateAminoAcids). Neither notices if the two halves
// disagree, which is precisely what a phase or strand-order slip does: both
// sides stay internally consistent and the letters land on the wrong codons.
// Reading the bases back out of the genome is the only check that closes it.
//
// Run across every strand × phase combination because the two interact. The
// translation reverses the segment list through revlist and the overlay reverses
// it through transcriptCDS — two separate reversals that have to agree on which
// segment carries the transcript's phase, and on the - strand that is the
// HIGHEST-coordinate one.

const code = getGeneticCode(undefined)

function feat(opts: Record<string, unknown>): Feature {
  return {
    get: (k: string) => opts[k],
    id: () => 'tx',
  } as unknown as Feature
}

// A deterministic pseudo-genome, stepped so consecutive codons differ — a
// constant-base genome would translate everything to one residue and pass no
// matter how badly the mapping was shuffled.
const BASES = 'ACGT'
const genome = Array.from(
  { length: 400 },
  (_, i) => BASES[(i * 7 + (i % 5)) % 4]!,
).join('')

// The transcribed bases under one cell, 5'→3'.
function cellBases(aa: AggregatedAminoAcid, strand: number) {
  const bases = genome.slice(aa.startBp, aa.endBp)
  return strand === -1 ? revcom(bases) : bases
}

// Two CDS exons separated by an intron. `firstExonLen` is the length of the
// first exon IN TRANSCRIPTION ORDER, which on the - strand is the
// high-coordinate one — so the geometry is written once and the strand only
// decides which end the phase hangs off.
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
  // through transcriptCDS, the ordering helper the emitter itself uses, so the
  // reversal under test is the shipped one rather than a copy of it
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
      // guard against the filter emptying and the test asserting nothing
      expect(whole.length).toBeGreaterThan(2)
      for (const aa of whole) {
        expect([aa.startBp, aa.aminoAcid]).toEqual([
          aa.startBp,
          code.codonTable[cellBases(aa, strand)],
        ])
      }
    },
  )

  // The pieces the check above skips. A codon split by an intron is two cells
  // whose three bases are not genomically contiguous, and stitching them back
  // together in TRANSCRIPTION order is the step a strand slip breaks: on the -
  // strand the 5' piece is the one at the HIGHER coordinate, so concatenating
  // in genomic order yields a different codon that still translates to
  // something, silently.
  test.each([0, 1, 2])(
    'phase %i: a codon split by the intron stitches back',
    phase => {
      // There is only something to stitch when the intron lands mid-codon, and
      // which exon lengths do that depends on the phase: the reading frame starts
      // (3 - phase) % 3 bases in, so an 11bp first exon ends exactly on a codon
      // boundary at phase 2. One extra base moves it off, for that phase only.
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
