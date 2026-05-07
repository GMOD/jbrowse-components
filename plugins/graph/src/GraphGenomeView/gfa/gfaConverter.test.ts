import { convertGFAToGraph } from './gfaConverter.ts'
import { parseGFA } from './gfaParser.ts'

test('converts simple GFA to graph with strand-specific nodes', () => {
  const gfa = parseGFA(`S\t1\tACGT
S\t2\tGGCC
L\t1\t+\t2\t+\t0M`)
  const graph = convertGFAToGraph(gfa, 'test')

  expect(graph.name).toBe('test')
  expect(graph.nodes).toHaveLength(2)
  expect(graph.nodes.map(n => n.id).sort()).toEqual(['1+', '2+'])
  expect(graph.edges).toHaveLength(1)
  expect(graph.edges[0]!.from).toBe('1+')
  expect(graph.edges[0]!.to).toBe('2+')
})

test('creates minus-strand nodes when linked', () => {
  const gfa = parseGFA(`S\t1\tACGT
S\t2\tGGCC
L\t1\t+\t2\t-\t0M`)
  const graph = convertGFAToGraph(gfa)

  const ids = graph.nodes.map(n => n.id).sort()
  expect(ids).toEqual(['1+', '2-'])
})

test('parses CIGAR overlap', () => {
  const gfa = parseGFA(`S\t1\tACGT
S\t2\tGGCC
L\t1\t+\t2\t+\t10M`)
  const graph = convertGFAToGraph(gfa)
  expect(graph.edges[0]!.overlap).toBe(10)
})

test('extracts depth from dp tag', () => {
  const gfa = parseGFA(`S\t1\tACGT\tdp:i:42
S\t2\tGGCC
L\t1\t+\t2\t+\t0M`)
  const graph = convertGFAToGraph(gfa)
  const node1 = graph.nodes.find(n => n.id === '1+')
  expect(node1!.depth).toBe(42)
})

test('maps paths to edges', () => {
  const gfa = parseGFA(`S\t1\tACGT
S\t2\tGGCC
S\t3\tTTAA
L\t1\t+\t2\t+\t0M
L\t2\t+\t3\t+\t0M
P\tp1\t1+,2+,3+\t*`)
  const graph = convertGFAToGraph(gfa)

  expect(graph.paths).toHaveLength(1)
  expect(graph.paths![0]!.name).toBe('p1')
  expect(graph.paths![0]!.nodeIds).toEqual(['1+', '2+', '3+'])

  expect(graph.edges[0]!.pathIds).toEqual(['p1'])
  expect(graph.edges[1]!.pathIds).toEqual(['p1'])
})

test('handles graph with no paths', () => {
  const gfa = parseGFA(`S\t1\tACGT
S\t2\tGGCC
L\t1\t+\t2\t+\t0M`)
  const graph = convertGFAToGraph(gfa)
  expect(graph.paths).toBeUndefined()
})

test('handles wildcard CIGAR', () => {
  const gfa = parseGFA(`S\t1\tACGT
S\t2\tGGCC
L\t1\t+\t2\t+\t*`)
  const graph = convertGFAToGraph(gfa)
  expect(graph.edges[0]!.overlap).toBe(0)
})

test('preserves node length from sequence', () => {
  const gfa = parseGFA('S\tnode1\tACGTACGT')
  const graph = convertGFAToGraph(gfa)
  expect(graph.nodes[0]!.length).toBe(8)
})

test('creates nodes from segment-only GFA (no links)', () => {
  const gfa = parseGFA(`S\tseq1\tACGT
S\tseq2\tGGCC`)
  const graph = convertGFAToGraph(gfa)
  expect(graph.nodes).toHaveLength(2)
  expect(graph.nodes.map(n => n.id).sort()).toEqual(['seq1+', 'seq2+'])
  expect(graph.edges).toHaveLength(0)
})

test('includes path-only nodes not referenced by links', () => {
  const gfa = parseGFA(`S\t1\tACGT
S\t2\tGGCC
S\t3\tTTAA
L\t1\t+\t2\t+\t0M
P\tp1\t1+,2+,3+\t*`)
  const graph = convertGFAToGraph(gfa)

  const ids = graph.nodes.map(n => n.id).sort()
  expect(ids).toContain('3+')
  expect(ids).toEqual(['1+', '2+', '3+'])
})

test('handles path referencing minus strand of unlinked node', () => {
  const gfa = parseGFA(`S\t1\tACGT
S\t2\tGGCC
L\t1\t+\t2\t+\t0M
P\tp1\t1+,2+,1-\t*`)
  const graph = convertGFAToGraph(gfa)

  const ids = graph.nodes.map(n => n.id).sort()
  expect(ids).toContain('1-')
})

test('converts W-line walks to graph paths', () => {
  const gfa = parseGFA(`S\tA\tACGT
S\tB\tGGCC
S\tC\tTTAA
L\tA\t+\tB\t+\t0M
L\tB\t+\tC\t+\t0M
W\tsample1\t0\tchr1\t0\t1000\t>A>B>C`)
  const graph = convertGFAToGraph(gfa)

  expect(graph.paths).toHaveLength(1)
  expect(graph.paths![0]!.name).toBe('sample1#0')
  expect(graph.paths![0]!.nodeIds).toEqual(['A+', 'B+', 'C+'])
  expect(graph.paths![0]!.sample).toBe('sample1')
  expect(graph.paths![0]!.haplotype).toBe(0)
  expect(graph.paths![0]!.contig).toBe('chr1')
})

test('walks create strand-specific nodes', () => {
  const gfa = parseGFA(`S\tA\tACGT
S\tB\tGGCC
W\tsample1\t0\tchr1\t*\t*\t>A<B`)
  const graph = convertGFAToGraph(gfa)

  const ids = graph.nodes.map(n => n.id).sort()
  expect(ids).toEqual(['A+', 'B-'])
})

test('walks annotate edge pathIds', () => {
  const gfa = parseGFA(`S\tA\tACGT
S\tB\tGGCC
L\tA\t+\tB\t+\t0M
W\tw1\t0\tchr1\t*\t*\t>A>B
W\tw2\t1\tchr1\t*\t*\t>A>B`)
  const graph = convertGFAToGraph(gfa)

  const edge = graph.edges[0]!
  expect(edge.pathIds).toContain('w1#0')
  expect(edge.pathIds).toContain('w2#1')
})

test('handles getSubgraph output format (star sequences with LN tags)', () => {
  // This is the format produced by GfaAdapter/GfaTabixAdapter getSubgraph:
  // segments have * sequences with LN:i: tags, links and P-line paths
  const gfaText = [
    'H\tVN:Z:1.1',
    'S\ts1\t*\tLN:i:100',
    'S\ts2\t*\tLN:i:100',
    'S\ts3\t*\tLN:i:100',
    'S\ts4\t*\tLN:i:101',
    'L\ts1\t+\ts2\t+\t*',
    'L\ts1\t+\ts3\t+\t*',
    'L\ts2\t+\ts4\t+\t*',
    'L\ts3\t+\ts4\t+\t*',
    'P\tref#1#chr1\ts1+,s2+,s4+\t*',
    'P\tsample1#1#chr1\ts1+,s3+,s4+\t*',
  ].join('\n')

  const parsed = parseGFA(gfaText)
  expect(parsed.nodes).toHaveLength(4)
  expect(parsed.links).toHaveLength(4)
  expect(parsed.paths).toHaveLength(2)

  // LN:i: tag should set node length even with * sequence
  for (const node of parsed.nodes) {
    expect(node.length).toBeGreaterThan(0)
  }

  const graph = convertGFAToGraph(parsed, 'subgraph-test')
  expect(graph.nodes.length).toBe(4)
  expect(graph.edges.length).toBe(4)
  expect(graph.paths).toHaveLength(2)
  expect(graph.name).toBe('subgraph-test')

  // Verify node lengths are preserved from LN tags
  const s1 = graph.nodes.find(n => n.name === 's1')
  expect(s1!.length).toBe(100)
  const s4 = graph.nodes.find(n => n.name === 's4')
  expect(s4!.length).toBe(101)

  // Verify edges have path annotations
  const s1ToS2 = graph.edges.find(e => e.from === 's1+' && e.to === 's2+')
  expect(s1ToS2!.pathIds).toContain('ref#1#chr1')
})

test('mixed P-lines and W-lines both become paths', () => {
  const gfa = parseGFA(`S\tA\tACGT
S\tB\tGGCC
S\tC\tTTAA
L\tA\t+\tB\t+\t0M
L\tB\t+\tC\t+\t0M
P\tref\tA+,B+,C+\t*
W\tsample1\t0\tchr1\t0\t1000\t>A>B>C`)
  const graph = convertGFAToGraph(gfa)

  expect(graph.paths).toHaveLength(2)
  expect(graph.paths![0]!.name).toBe('ref')
  expect(graph.paths![1]!.name).toBe('sample1#0')
  expect(graph.paths![1]!.sample).toBe('sample1')
})
