import { buildRefNameMaps, isAssembledMolecule } from './refNameMaps.ts'

// chromAlias-style: refName column matches the FASTA, no override flag
test('chromAlias-style aliases map every alias to the refName column', () => {
  const { refNameAliases, canonicalToSeqAdapterRefNames } = buildRefNameMaps(
    [{ refName: 'chr1' }],
    [{ refName: 'chr1', aliases: ['chr1', '1', 'NC_000001.10'] }],
  )
  expect(refNameAliases['1']).toBe('chr1')
  expect(refNameAliases['NC_000001.10']).toBe('chr1')
  expect(refNameAliases.chr1).toBe('chr1')
  // canonical equals the FASTA name, so no seq-adapter remap is recorded
  expect(canonicalToSeqAdapterRefNames).toEqual({})
})

const ncbiAlias = {
  refName: 'chr1',
  aliases: ['CM000663.2', 'NC_000001.11', 'chr1', '1'],
}

// useNameOverride:true forces the UCSC name canonical even when the FASTA uses
// RefSeq accessions; the seq-adapter remap lets reads still fetch by accession
test('override:true makes the adapter refName canonical and records the seq-adapter remap', () => {
  const { refNameAliases, canonicalToSeqAdapterRefNames } = buildRefNameMaps(
    [{ refName: 'NC_000001.11' }],
    [{ ...ncbiAlias, override: true }],
  )
  expect(refNameAliases['NC_000001.11']).toBe('chr1')
  expect(canonicalToSeqAdapterRefNames.chr1).toBe('NC_000001.11')
})

// useNameOverride:false keeps the FASTA's own (RefSeq) name canonical; the UCSC
// name resolves to it as an alias and no remap is needed
test('override:false keeps the FASTA refName canonical', () => {
  const { refNameAliases, canonicalToSeqAdapterRefNames } = buildRefNameMaps(
    [{ refName: 'NC_000001.11' }],
    [{ ...ncbiAlias, override: false }],
  )
  expect(refNameAliases.chr1).toBe('NC_000001.11')
  expect(refNameAliases['NC_000001.11']).toBe('NC_000001.11')
  expect(canonicalToSeqAdapterRefNames).toEqual({})
})

// override:false with no alias matching any FASTA contig falls back to the
// adapter's refName rather than dropping the group
test('override:false falls back to the adapter refName when no alias matches the FASTA', () => {
  const { refNameAliases } = buildRefNameMaps(
    [{ refName: 'someUnrelatedContig' }],
    [{ ...ncbiAlias, override: false }],
  )
  expect(refNameAliases.chr1).toBe('chr1')
})

// a contig named like an Object.prototype member is a real contig, and a query
// naming one that is not in the assembly finds nothing
test('prototype member names are ordinary names', () => {
  const { refNameAliases, lowerCaseRefNameAliases } = buildRefNameMaps(
    [{ refName: 'chr1' }, { refName: 'constructor' }],
    [],
  )
  expect(refNameAliases.constructor).toBe('constructor')
  expect(refNameAliases.toString).toBeUndefined()
  expect(lowerCaseRefNameAliases.hasOwnProperty).toBeUndefined()
})

test('roles are keyed by the canonical name, whichever name the row gives', () => {
  const { sequenceRoles } = buildRefNameMaps(
    [{ refName: 'NC_000001.11' }, { refName: 'NC_012920.1' }],
    [
      {
        ...ncbiAlias,
        override: false,
        role: 'assembled-molecule',
        molecule: 'Chromosome',
      },
      {
        refName: 'chrM',
        aliases: ['NC_012920.1', 'chrM'],
        override: false,
        role: 'assembled-molecule',
        molecule: 'Mitochondrion',
      },
    ],
  )
  expect(Object.fromEntries(sequenceRoles)).toEqual({
    'NC_000001.11': { role: 'assembled-molecule', molecule: 'Chromosome' },
    'NC_012920.1': { role: 'assembled-molecule', molecule: 'Mitochondrion' },
  })
})

test('a chromAlias row states no role', () => {
  const { sequenceRoles } = buildRefNameMaps(
    [{ refName: 'chr1' }],
    [{ refName: 'chr1', aliases: ['chr1', '1'] }],
  )
  expect(Object.fromEntries(sequenceRoles)).toEqual({})
})

test.each([
  [{ role: 'assembled-molecule', molecule: 'Chromosome' }, true],
  [{ role: 'assembled-molecule', molecule: 'Linkage Group' }, true],
  [{ role: 'assembled-molecule', molecule: 'Plasmid' }, true],
  [{ role: 'assembled-molecule', molecule: 'Chloroplast' }, true],
  [{ role: 'assembled-molecule', molecule: 'Mitochondrion' }, true],
  [{ role: 'assembled-molecule', molecule: 'Segment' }, true],
  [{ role: 'assembled-molecule' }, true],
  [{ role: 'unplaced-scaffold', molecule: 'Chromosome' }, false],
  [{ role: 'unlocalized-scaffold', molecule: 'Chromosome' }, false],
  [{ role: 'alt-scaffold', molecule: 'Chromosome' }, false],
  [{ role: 'novel-patch', molecule: 'Chromosome' }, false],
  [{ role: 'fix-patch', molecule: 'Chromosome' }, false],
  [undefined, false],
])('isAssembledMolecule(%o) is %s', (sequence, expected) => {
  expect(isAssembledMolecule(sequence)).toBe(expected)
})
