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
