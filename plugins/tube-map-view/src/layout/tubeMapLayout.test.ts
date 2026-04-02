import { computeTubeMapLayout } from './tubeMapLayout.ts'
import { layoutGFA } from './gfaToTubeMap.ts'
import { parseGFA } from '../gfa/gfaParser.ts'

// simple bubble: ref goes 1→2→4, alt goes 1→3→4
const SIMPLE_BUBBLE_GFA = `H\tVN:Z:1.0
S\t1\tACGT
S\t2\tGGCC
S\t3\tTTAA
S\t4\tCCGG
L\t1\t+\t2\t+\t0M
L\t1\t+\t3\t+\t0M
L\t2\t+\t4\t+\t0M
L\t3\t+\t4\t+\t0M
P\tref\t1+,2+,4+\t*
P\talt\t1+,3+,4+\t*`

// two-bubble chain from sequenceTubeMap example
const TWO_BUBBLE_GFA = `H\tVN:Z:1.0
S\t1\tCAAATAAG
S\t2\tA
S\t3\tG
S\t4\tT
S\t5\tC
S\t6\tTTG
S\t7\tA
S\t8\tG
S\t9\tAAATTTTCTGGAGTTCTAT
S\t10\tA
S\t11\tT
S\t12\tATAT
S\t13\tA
S\t14\tT
S\t15\tCCAACTCTCTG
L\t1\t+\t2\t+\t0M
L\t1\t+\t3\t+\t0M
L\t2\t+\t4\t+\t0M
L\t2\t+\t5\t+\t0M
L\t3\t+\t4\t+\t0M
L\t3\t+\t5\t+\t0M
L\t4\t+\t6\t+\t0M
L\t5\t+\t6\t+\t0M
L\t6\t+\t7\t+\t0M
L\t6\t+\t8\t+\t0M
L\t7\t+\t9\t+\t0M
L\t8\t+\t9\t+\t0M
L\t9\t+\t10\t+\t0M
L\t9\t+\t11\t+\t0M
L\t10\t+\t12\t+\t0M
L\t11\t+\t12\t+\t0M
L\t12\t+\t13\t+\t0M
L\t12\t+\t14\t+\t0M
L\t13\t+\t15\t+\t0M
L\t14\t+\t15\t+\t0M
P\tx\t1+,3+,5+,6+,8+,9+,11+,12+,14+,15+\t*
P\ty\t1+,2+,4+,6+,7+,9+,10+,12+,13+,15+\t*`

describe('computeTubeMapLayout', () => {
  test('simple bubble: all nodes get unique orders', () => {
    const layout = computeTubeMapLayout(
      [
        { name: '1', sequenceLength: 4 },
        { name: '2', sequenceLength: 4 },
        { name: '3', sequenceLength: 4 },
        { name: '4', sequenceLength: 4 },
      ],
      [
        {
          id: 'ref',
          name: 'ref',
          segments: [
            { name: '1', isForward: true },
            { name: '2', isForward: true },
            { name: '4', isForward: true },
          ],
          type: 'haplotype',
          indexOfFirstBase: 0,
        },
        {
          id: 'alt',
          name: 'alt',
          segments: [
            { name: '1', isForward: true },
            { name: '3', isForward: true },
            { name: '4', isForward: true },
          ],
          type: 'haplotype',
          indexOfFirstBase: 0,
        },
      ],
    )

    expect(layout.nodes).toHaveLength(4)
    expect(layout.tracks).toHaveLength(2)

    // node 1 should be leftmost
    const node1 = layout.nodes.find(n => n.name === '1')!
    const node2 = layout.nodes.find(n => n.name === '2')!
    const node3 = layout.nodes.find(n => n.name === '3')!
    const node4 = layout.nodes.find(n => n.name === '4')!

    expect(node1.order).toBeLessThan(node2.order)
    expect(node1.order).toBeLessThan(node3.order)
    expect(node2.order).toBeLessThan(node4.order)
    expect(node3.order).toBeLessThan(node4.order)

    // x coordinates should follow order
    expect(node1.x).toBeLessThan(node2.x)
    expect(node1.x).toBeLessThan(node3.x)
    expect(node2.x).toBeLessThan(node4.x)
  })

  test('tracks have path segments', () => {
    const layout = computeTubeMapLayout(
      [
        { name: '1', sequenceLength: 4 },
        { name: '2', sequenceLength: 4 },
        { name: '3', sequenceLength: 4 },
        { name: '4', sequenceLength: 4 },
      ],
      [
        {
          id: 'ref',
          name: 'ref',
          segments: [
            { name: '1', isForward: true },
            { name: '2', isForward: true },
            { name: '4', isForward: true },
          ],
          type: 'haplotype',
          indexOfFirstBase: 0,
        },
      ],
    )

    const refTrack = layout.tracks[0]!
    expect(refTrack.path.length).toBeGreaterThanOrEqual(3)
    // first segment should be at node 1
    expect(refTrack.path[0]!.node).toBe(0)
  })
})

describe('layoutGFA', () => {
  test('simple bubble from GFA text', () => {
    const gfa = parseGFA(SIMPLE_BUBBLE_GFA)
    const layout = layoutGFA(gfa)

    expect(layout.nodes).toHaveLength(4)
    expect(layout.tracks).toHaveLength(2)
    expect(layout.maxX).toBeGreaterThan(0)
    expect(layout.maxY).toBeGreaterThan(0)
  })

  test('two-bubble chain from GFA text', () => {
    const gfa = parseGFA(TWO_BUBBLE_GFA)
    const layout = layoutGFA(gfa)

    expect(layout.nodes).toHaveLength(15)
    expect(layout.tracks).toHaveLength(2)

    // all nodes should have positive x coordinates
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0)
    }

    // shared nodes (1, 6, 9, 12, 15) should have same order for both tracks
    const node1 = layout.nodes.find(n => n.name === '1')!
    const node6 = layout.nodes.find(n => n.name === '6')!
    const node15 = layout.nodes.find(n => n.name === '15')!
    expect(node1.order).toBeLessThan(node6.order)
    expect(node6.order).toBeLessThan(node15.order)
  })

  test('nodes in parallel bubbles get different vertical positions', () => {
    const gfa = parseGFA(SIMPLE_BUBBLE_GFA)
    const layout = layoutGFA(gfa)

    const node2 = layout.nodes.find(n => n.name === '2')!
    const node3 = layout.nodes.find(n => n.name === '3')!

    // bubble arms should be at different y positions
    expect(node2.y).not.toBe(node3.y)
  })
})
