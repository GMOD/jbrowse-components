import { buildSignificanceLines } from './significanceLines.ts'

const thresholds = [
  { value: 7.3, color: '#d43f3a', label: 'Genome-wide' },
  { value: 5, color: '#357ebd', label: 'Suggestive' },
]

test('maps in-domain thresholds to y positions', () => {
  const lines = buildSignificanceLines({
    thresholds,
    domain: [0, 10],
    height: 100,
    offset: 5,
  })
  expect(lines.map(l => l.label)).toEqual(['Genome-wide', 'Suggestive'])
  // higher -log10(p) sits nearer the top (smaller y)
  expect(lines[0]!.y).toBeLessThan(lines[1]!.y)
})

test('drops thresholds outside the domain', () => {
  const lines = buildSignificanceLines({
    thresholds,
    domain: [0, 6],
    height: 100,
    offset: 5,
  })
  expect(lines.map(l => l.label)).toEqual(['Suggestive'])
})

test('drops a threshold equal to a domain endpoint', () => {
  const lines = buildSignificanceLines({
    thresholds,
    domain: [5, 7.3],
    height: 100,
    offset: 5,
  })
  expect(lines).toHaveLength(0)
})
