import {
  buildRefNameMaps,
  groupNamesByCanonicalRefName,
} from './refNameMaps.ts'

test('groups every alias under its canonical name, canonical first', () => {
  const { refNameAliases } = buildRefNameMaps(
    [{ refName: 'chr1' }, { refName: 'chr2' }],
    [
      { refName: 'chr1', aliases: ['1', 'NC_000001.10'] },
      { refName: 'chr2', aliases: ['2'] },
    ],
  )
  expect([...groupNamesByCanonicalRefName(refNameAliases)]).toEqual([
    ['chr1', ['chr1', '1', 'NC_000001.10']],
    ['chr2', ['chr2', '2']],
  ])
})

// the alias adapter lists the canonical name among the aliases as often as not
// (a UCSC chromAlias row repeats it in the ucsc column), and buildRefNameMaps
// identity-maps it besides — either would put it in the group twice
test('names the canonical once when it is also listed as an alias', () => {
  const { refNameAliases } = buildRefNameMaps(
    [{ refName: 'chr1' }],
    [{ refName: 'chr1', aliases: ['chr1', '1'] }],
  )
  expect(groupNamesByCanonicalRefName(refNameAliases).get('chr1')).toEqual([
    'chr1',
    '1',
  ])
})

// a contig with no aliases is still a row: the About dialog's listing is every
// sequence the assembly has, not just the aliased ones
test('keeps a contig with no aliases', () => {
  const { refNameAliases } = buildRefNameMaps([{ refName: 'ctgA' }], [])
  expect(groupNamesByCanonicalRefName(refNameAliases).get('ctgA')).toEqual([
    'ctgA',
  ])
})

// override:true remaps the FASTA's own name to the alias file's, so the FASTA
// name has to appear as one of the group's aliases rather than as its own row
test('an override remap lists the sequence-adapter name as an alias', () => {
  const { refNameAliases } = buildRefNameMaps(
    [{ refName: 'NC_000001.11' }],
    [
      {
        refName: 'chr1',
        aliases: ['NC_000001.11', '1'],
        override: true,
      },
    ],
  )
  expect([...groupNamesByCanonicalRefName(refNameAliases).keys()]).toEqual([
    'chr1',
  ])
  // '1' ahead of the accession it was listed after: the alias map is a plain
  // object, so an integer-like key enumerates first whatever order it went in
  expect(groupNamesByCanonicalRefName(refNameAliases).get('chr1')).toEqual([
    'chr1',
    '1',
    'NC_000001.11',
  ])
})
