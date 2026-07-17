import { buildRefNameMaps } from './refNameMaps.ts'

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
