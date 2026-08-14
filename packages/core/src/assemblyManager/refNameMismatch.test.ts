import {
  detectRefNameMismatch,
  refNameMismatchMessage,
} from './refNameMismatch.ts'

// An assembly that knows only its own names, i.e. no refNameAliases configured
function bareAssembly(refNames: string[]) {
  const known = new Set(refNames)
  return {
    assemblyName: 'hg38',
    assemblyRefNames: refNames,
    getCanonicalRefName: (name: string) => (known.has(name) ? name : undefined),
  }
}

const CHR = ['chr1', 'chr2', 'chr3', 'chrX', 'chrM']

// The classic: an Ensembl-named file against a UCSC-named assembly. The map
// loadRefNameMap builds from this is an identity map that matches no region, so
// the track draws nothing and there is no error anywhere to show for it.
test('reports when the two name sets share nothing', () => {
  const mismatch = detectRefNameMismatch({
    ...bareAssembly(CHR),
    adapterRefNames: ['1', '2', '3'],
  })
  expect(mismatch).toEqual({
    assemblyName: 'hg38',
    adapter: { names: ['1', '2', '3'], total: 3 },
    assembly: { names: CHR, total: 5 },
  })
})

// The whole reason this is a check on the INTERSECTION rather than on any
// individual name. A track covering some contigs, a sample-specific VCF, a file
// that stops at the primary assembly — all ordinary, all partial.
test('does not report on partial overlap', () => {
  expect(
    detectRefNameMismatch({
      ...bareAssembly(CHR),
      adapterRefNames: ['chr1', 'contig_not_in_the_assembly'],
    }),
  ).toBeUndefined()
})

test('does not report when only one name in a long list matches', () => {
  expect(
    detectRefNameMismatch({
      ...bareAssembly(CHR),
      adapterRefNames: ['1', '2', '3', '4', 'chrM'],
    }),
  ).toBeUndefined()
})

// The names go through the assembly's own normalization, which resolves aliases
// and casing together. Comparing them to the assembly's names directly would
// report a mismatch on exactly the aliased tracks refNameAliases exists to fix.
test('does not report when the aliases resolve the file names', () => {
  expect(
    detectRefNameMismatch({
      assemblyName: 'hg38',
      assemblyRefNames: CHR,
      adapterRefNames: ['1', '2', '3'],
      getCanonicalRefName: name => `chr${name}`,
    }),
  ).toBeUndefined()
})

// Many adapters legitimately report no refNames at all (CoreGetRefNames answers
// [] for anything that is not a refName source), and an assembly is empty until
// it has loaded. Neither is evidence of a misconfiguration.
test('does not report when either list is empty', () => {
  expect(
    detectRefNameMismatch({ ...bareAssembly(CHR), adapterRefNames: [] }),
  ).toBeUndefined()
  expect(
    detectRefNameMismatch({
      ...bareAssembly([]),
      adapterRefNames: ['1', '2', '3'],
    }),
  ).toBeUndefined()
})

// A mammalian assembly has hundreds of contigs and a scaffold-level one has
// tens of thousands; the record is held in a volatile and pasted into a dialog,
// so it keeps a sample and a count rather than the lists.
test('keeps a sample of each list plus the total', () => {
  const many = Array.from({ length: 400 }, (_, i) => `${i + 1}`)
  const mismatch = detectRefNameMismatch({
    ...bareAssembly(CHR),
    adapterRefNames: many,
  })
  expect(mismatch?.adapter).toEqual({
    names: ['1', '2', '3', '4', '5'],
    total: 400,
  })
})

test('the message names the assembly, both schemes and both remedies', () => {
  const message = refNameMismatchMessage(
    detectRefNameMismatch({
      ...bareAssembly(CHR),
      adapterRefNames: ['1', '2', '3', '4', '5', '6', '7'],
    })!,
  )
  expect(message).toContain('"hg38"')
  expect(message).toContain('1, 2, 3, 4, 5 (and 2 more)')
  expect(message).toContain('chr1, chr2, chr3, chrX, chrM')
  expect(message).toContain('refNameAliases')
  expect(message).toContain('rebuild the file')
})
