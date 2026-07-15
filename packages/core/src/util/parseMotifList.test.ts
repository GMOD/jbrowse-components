import { parseMotifList } from './parseMotifList.ts'

test('parses name + site with a cut position', () => {
  const { motifs, errors } = parseMotifList('EcoRI  G^AATTC')
  expect(errors).toEqual([])
  expect(motifs).toEqual([{ name: 'EcoRI', site: 'GAATTC', cutOffset: 1 }])
})

test('a bare site names itself and has no cut position', () => {
  const { motifs } = parseMotifList('ggtnacc')
  expect(motifs).toEqual([{ name: 'GGTNACC', site: 'GGTNACC' }])
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
  expect(parseMotifList('KpnI GGTAC^C').motifs[0]).toEqual({
    name: 'KpnI',
    site: 'GGTACC',
    cutOffset: 5,
  })
})
