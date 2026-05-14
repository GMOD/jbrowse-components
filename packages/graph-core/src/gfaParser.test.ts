import { parseGFA } from './gfaParser.ts'

test('parses GFA1 segments', () => {
  const gfa = parseGFA('S\tnode1\tACGT')
  expect(gfa.nodes).toHaveLength(1)
  expect(gfa.nodes[0]!.id).toBe('node1')
  expect(gfa.nodes[0]!.sequence).toBe('ACGT')
  expect(gfa.nodes[0]!.length).toBe(4)
})

test('parses GFA1 segment with LN tag override', () => {
  const gfa = parseGFA('S\tnode1\tACGT\tLN:i:1000')
  expect(gfa.nodes[0]!.length).toBe(1000)
})

test('parses GFA1 links with strands', () => {
  const gfa = parseGFA('L\tA\t+\tB\t-\t5M')
  expect(gfa.links).toHaveLength(1)
  expect(gfa.links[0]!.source).toBe('A')
  expect(gfa.links[0]!.target).toBe('B')
  expect(gfa.links[0]!.strand1).toBe('+')
  expect(gfa.links[0]!.strand2).toBe('-')
  expect(gfa.links[0]!.cigar).toBe('5M')
})

test('parses GFA1 paths', () => {
  const gfa = parseGFA('P\tpath1\tA+,B+,C-\t*')
  expect(gfa.paths).toHaveLength(1)
  expect(gfa.paths[0]!.name).toBe('path1')
  expect(gfa.paths[0]!.path).toBe('A+,B+,C-')
})

test('parses header lines', () => {
  const gfa = parseGFA('H\tVN:Z:1.0')
  expect(gfa.header).toHaveLength(1)
  expect(gfa.header[0]).toEqual({ VN: '1.0' })
})

test('parses GFA2 edge lines', () => {
  const gfa = parseGFA('E\t*\tA+\tB-\t0\t10\t0\t10\t10M')
  expect(gfa.links).toHaveLength(1)
  expect(gfa.links[0]!.source).toBe('A')
  expect(gfa.links[0]!.target).toBe('B')
  expect(gfa.links[0]!.strand1).toBe('+')
  expect(gfa.links[0]!.strand2).toBe('-')
})

test('parses complete GFA with multiple record types', () => {
  const gfa = parseGFA(`H\tVN:Z:1.0
S\t1\tACGT
S\t2\tGGCC
L\t1\t+\t2\t+\t0M
P\tp1\t1+,2+\t*`)
  expect(gfa.nodes).toHaveLength(2)
  expect(gfa.links).toHaveLength(1)
  expect(gfa.paths).toHaveLength(1)
})

test('parses segment tags (depth)', () => {
  const gfa = parseGFA('S\tnode1\tACGT\tdp:i:42')
  expect(gfa.nodes[0]!.tags.dp).toBe(42)
})

test('handles empty lines and unknown record types', () => {
  const gfa = parseGFA('S\t1\tACGT\n\nX\tunknown\nS\t2\tGGCC')
  expect(gfa.nodes).toHaveLength(2)
})

test('parses W-line walks', () => {
  const gfa = parseGFA('W\tHG00438\t1\tchr6\t0\t50000\t>A>B<C>D')
  expect(gfa.walks).toHaveLength(1)
  const walk = gfa.walks[0]!
  expect(walk.sample).toBe('HG00438')
  expect(walk.haplotype).toBe(1)
  expect(walk.contig).toBe('chr6')
  expect(walk.start).toBe(0)
  expect(walk.end).toBe(50000)
  expect(walk.segments).toEqual([
    { id: 'A', strand: '+' },
    { id: 'B', strand: '+' },
    { id: 'C', strand: '-' },
    { id: 'D', strand: '+' },
  ])
})

test('parses W-line with wildcard coordinates', () => {
  const gfa = parseGFA('W\tsample1\t0\tctg1\t*\t*\t>s1>s2>s3')
  const walk = gfa.walks[0]!
  expect(walk.start).toBe(-1)
  expect(walk.end).toBe(-1)
  expect(walk.segments).toHaveLength(3)
})

test('parses W-line with tags', () => {
  const gfa = parseGFA(
    'W\tsample1\t0\tchr1\t0\t1000\t>A>B\tlf:i:42\txx:Z:hello',
  )
  const walk = gfa.walks[0]!
  expect(walk.tags.lf).toBe(42)
  expect(walk.tags.xx).toBe('hello')
})

test('parses pangene-style GFA with W-lines', () => {
  const gfa = parseGFA(`H\tVN:Z:1.1
S\tGENE1\t*\tLN:i:5000\tSN:Z:chr1\tSO:i:100
S\tGENE2\t*\tLN:i:3000\tSN:Z:chr1\tSO:i:6000
S\tGENE3\t*\tLN:i:2000\tSN:Z:chr1\tSO:i:10000
L\tGENE1\t+\tGENE2\t+\t0M
L\tGENE2\t+\tGENE3\t+\t0M
L\tGENE1\t+\tGENE3\t+\t0M
W\tref\t0\tchr1\t0\t12000\t>GENE1>GENE2>GENE3
W\tsample1\t0\tchr1\t0\t10000\t>GENE1>GENE3
W\tsample2\t0\tchr1\t0\t12000\t>GENE1>GENE2>GENE3`)
  expect(gfa.nodes).toHaveLength(3)
  expect(gfa.links).toHaveLength(3)
  expect(gfa.walks).toHaveLength(3)
  expect(gfa.walks[1]!.segments).toHaveLength(2)
})
