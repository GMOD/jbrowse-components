import {
  assemblyContigLengths,
  contigLengthMismatchMessage,
  detectContigLengthMismatch,
} from './contigLengthMismatch.ts'

const HG38 = {
  chr1: 248_956_422,
  chr2: 242_193_529,
  chrX: 156_040_895,
  chrM: 16_569,
}
const HG19 = {
  chr1: 249_250_621,
  chr2: 243_199_373,
  chrX: 155_270_560,
  chrM: 16_571,
}
// CHM13v2.0 carries the rCRS mitochondrion, as hg38 does
const CHM13 = {
  chr1: 248_387_328,
  chr2: 242_696_752,
  chrX: 154_259_566,
  chrM: 16_569,
}
// b37 differs from hg19 only in its mitochondrion, and in its names
const B37 = {
  '1': 249_250_621,
  '2': 243_199_373,
  X: 155_270_560,
  MT: 16_569,
}

function regionsOf(lengths: Record<string, number>) {
  return Object.entries(lengths).map(([refName, end]) => ({
    refName,
    start: 0,
    end,
  }))
}

function contigsOf(lengths: Record<string, number>) {
  return {
    refNames: Object.keys(lengths),
    lengths: Object.values(lengths),
  }
}

function detect(
  file: Record<string, number>,
  assembly: Record<string, number>,
  getCanonicalRefName = (name: string) => (name in assembly ? name : undefined),
) {
  return detectContigLengthMismatch({
    assemblyName: 'asm',
    contigs: contigsOf(file),
    assemblyLengths: assemblyContigLengths(regionsOf(assembly)),
    getCanonicalRefName,
  })
}

test('reports hg38 data on CHM13 despite the matching chrM', () => {
  expect(detect(HG38, CHM13)).toEqual({
    assemblyName: 'asm',
    differences: [
      { refName: 'chr1', fileLength: 248_956_422, assemblyLength: 248_387_328 },
      { refName: 'chr2', fileLength: 242_193_529, assemblyLength: 242_696_752 },
    ],
  })
})

test('reports hg19 data on hg38', () => {
  expect(detect(HG19, HG38)).toBeDefined()
})

test('does not report a file of the same build', () => {
  expect(detect(HG38, HG38)).toBeUndefined()
})

// The differing mitochondrion is real, but a build-wide warning on every b37
// BAM would be wrong; RefNameInfoDialog lists it instead
test('does not report b37 on hg19, which differ only on chrM', () => {
  expect(
    detect(B37, HG19, name => `chr${name === 'MT' ? 'M' : name}`),
  ).toBeUndefined()
})

// chr2 states no length and the HLA contig does not resolve, so chr1 decides
test('compares only contigs that resolve and state a length', () => {
  expect(
    detectContigLengthMismatch({
      assemblyName: 'asm',
      contigs: {
        refNames: ['chr1', 'chr2', 'HLA-A*01:01:01:01'],
        lengths: [HG38.chr1, undefined, 3503],
      },
      assemblyLengths: assemblyContigLengths(regionsOf(HG19)),
      getCanonicalRefName: name => (name in HG19 ? name : undefined),
    })?.differences,
  ).toEqual([
    { refName: 'chr1', fileLength: HG38.chr1, assemblyLength: HG19.chr1 },
  ])
})

// a demo FASTA cut from the start of chr20, with the BAM keeping its full @SQ
test('does not report an assembly that is a slice of the file', () => {
  expect(detect({ chr20: 64_444_167 }, { chr20: 29_565 })).toBeUndefined()
  expect(detect({ chr20: 29_565 }, { chr20: 64_444_167 })).toBeUndefined()
})

test('leaves sliced contigs out of the comparison', () => {
  expect(
    detect(
      { ...HG38, chr2: 1_000_000 },
      { ...CHM13, chr2: HG38.chr2 },
    )?.differences.map(d => d.refName),
  ).toEqual(['chr1', 'chrX'])
})

test('does not report when nothing is comparable', () => {
  expect(
    detectContigLengthMismatch({
      assemblyName: 'asm',
      contigs: { refNames: ['chr1'], lengths: [] },
      assemblyLengths: assemblyContigLengths(regionsOf(HG38)),
      getCanonicalRefName: name => name,
    }),
  ).toBeUndefined()
})

test('takes no length from a region that starts past 0', () => {
  expect(
    assemblyContigLengths([
      { refName: 'chr1', start: 0, end: 100 },
      { refName: 'chr2', start: 50, end: 100 },
    ]),
  ).toEqual(new Map([['chr1', 100]]))
})

test('the message names the build and the differing lengths', () => {
  expect(contigLengthMismatchMessage(detect(HG38, CHM13)!)).toBe(
    'This track\'s file looks to be from a different genome build than assembly "asm": ' +
      'most of the sequence they share is on reference sequences of different lengths ' +
      '(chr1 is 248,956,422 bp in the file, 248,387,328 bp in the assembly; ' +
      'chr2 is 242,193,529 bp in the file, 242,696,752 bp in the assembly). ' +
      "Its positions refer to the other build's sequence. " +
      'Load it against the assembly it was made with.',
  )
})
