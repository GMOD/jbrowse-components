import { forEachInsertion } from './forEachInsertion.ts'

const enc = new TextEncoder()
const b = (s: string) => enc.encode(s)

function runs(ref: string, aln: string, startBp = 100) {
  const out: {
    anchorBp: number
    length: number
    baseOffset: number
    byteStart: number
    byteEnd: number
  }[] = []
  forEachInsertion(
    b(ref),
    b(aln),
    startBp,
    (anchorBp, length, baseOffset, byteStart, byteEnd) => {
      out.push({ anchorBp, length, baseOffset, byteStart, byteEnd })
    },
  )
  return out
}

test('emits one run for a reference-gap column where the sample carries bases', () => {
  // ref AC---T, sample ACCCCT → a 3bp insertion before genomic 102 (the next
  // reference base after two ref bases A,C), with 2 preceding sample bases
  expect(runs('AC---T', 'ACCCCT')).toEqual([
    { anchorBp: 102, length: 3, baseOffset: 2, byteStart: 2, byteEnd: 5 },
  ])
})

test('no insertion when the reference has no gaps', () => {
  expect(runs('ACGT', 'ACGT')).toEqual([])
})

test('counts only this sample bases in the run, not padding dashes across rows', () => {
  // worker output pads every sample to the longest insertion (20 `-` in ref),
  // but this sample only inserted 5 bases — the run length must be 5, not 20.
  // The walk clamps to the shared min length, so byteEnd stops at 6.
  expect(runs(`A${'-'.repeat(20)}`, `A${'C'.repeat(5)}`)).toEqual([
    { anchorBp: 101, length: 5, baseOffset: 1, byteStart: 1, byteEnd: 6 },
  ])
})

test('a gap/space inside the insertion column run does not count as an inserted base', () => {
  // ref A---A, sample aC-gA: the middle ref-gap column is a `-` in the sample,
  // so only C and g count → length 2 (byteStart..byteEnd still spans the run)
  expect(runs('A---A', 'aC-gA')).toEqual([
    { anchorBp: 101, length: 2, baseOffset: 1, byteStart: 1, byteEnd: 4 },
  ])
})

test('alignment shorter than the reference truncates at the shared length', () => {
  // alignment overruns/underruns are clamped to min length; here the sample is
  // shorter than the reference so the trailing ref columns emit nothing
  expect(runs('ACGT', 'AC')).toEqual([])
})
