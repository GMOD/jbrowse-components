import { parseMotifList } from './parseMotifList.ts'

test('parses name + site with a cut position', () => {
  const { motifs, errors } = parseMotifList('EcoRI  G^AATTC')
  expect(errors).toEqual([])
  expect(motifs).toEqual([
    { name: 'EcoRI', site: 'GAATTC', line: 'EcoRI  G^AATTC', cutOffset: 1 },
  ])
})

test('a bare site names itself and has no cut position', () => {
  const { motifs } = parseMotifList('ggtnacc')
  expect(motifs).toEqual([
    { name: 'GGTNACC', site: 'GGTNACC', line: 'ggtnacc' },
  ])
})

test("REBASE (n/m) notation pins both of a type IIS enzyme's cuts", () => {
  // BsaI cuts 1nt past its 6bp site on top, 5nt past on the bottom, leaving a
  // 4-base 5' overhang; both offsets run past the site itself
  const { motifs, errors } = parseMotifList('BsaI GGTCTC(1/5)')
  expect(errors).toEqual([])
  expect(motifs[0]).toEqual({
    name: 'BsaI',
    site: 'GGTCTC',
    line: 'BsaI GGTCTC(1/5)',
    cutOffset: 7,
    cutOffsetBottom: 11,
  })
})

test('a negative (n/m) offset cuts back inside the site', () => {
  expect(parseMotifList('CAGNNNCTG(-5/-1)').motifs[0]).toMatchObject({
    site: 'CAGNNNCTG',
    cutOffset: 4,
    cutOffsetBottom: 8,
  })
})

test('rejects a line using both cut notations at once', () => {
  const { motifs, errors } = parseMotifList('Bad G^GTCTC(1/5)')
  expect(motifs).toEqual([])
  expect(errors[0]!.message).toMatch(/not both/)
})

test('skips blanks and comments, accepts tabs and commas', () => {
  const { motifs, errors } = parseMotifList(
    ['# common cutters', '', 'EcoRI\tG^AATTC', 'BamHI,G^GATCC', '   '].join(
      '\n',
    ),
  )
  expect(errors).toEqual([])
  expect(motifs.map(m => m.name)).toEqual(['EcoRI', 'BamHI'])
})

test('reports bad lines by line number without dropping the good ones', () => {
  const { motifs, errors } = parseMotifList(
    ['EcoRI G^AATTC', 'Bad GAXTTC', 'Two G^AA^TTC', 'Extra a b c'].join('\n'),
  )
  expect(motifs.map(m => m.name)).toEqual(['EcoRI'])
  expect(errors.map(e => e.line)).toEqual([2, 3, 4])
  expect(errors[0]!.message).toMatch(/non-IUPAC/)
  expect(errors[1]!.message).toMatch(/at most one \^/)
  expect(errors[2]!.message).toMatch(/Expected/)
})

test('a cut at the site edge is a valid offset', () => {
  expect(parseMotifList('KpnI GGTAC^C').motifs[0]).toMatchObject({
    name: 'KpnI',
    site: 'GGTACC',
    cutOffset: 5,
  })
})
