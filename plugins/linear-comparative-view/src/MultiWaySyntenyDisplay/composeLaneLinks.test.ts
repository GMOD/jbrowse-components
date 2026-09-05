import { SimpleFeature } from '@jbrowse/core/util'

import { composeLaneLinks } from './composeLaneLinks.ts'

import type { LanePlacementRecord } from './composeLaneLinks.ts'

interface Mate {
  assemblyName: string
  refName: string
  start: number
  end: number
}

function record(
  id: string,
  anchor: [number, number],
  lane: [string, number, number],
  strand: 1 | -1 = 1,
  anchorRefName = 'chr1',
): LanePlacementRecord {
  return {
    anchorRefName,
    anchorStart: anchor[0],
    anchorEnd: anchor[1],
    refName: lane[0],
    start: lane[1],
    end: lane[2],
    strand,
    feature: new SimpleFeature({
      uniqueId: id,
      refName: anchorRefName,
      start: anchor[0],
      end: anchor[1],
    }),
  }
}

function compose(
  upper: LanePlacementRecord[],
  lower: LanePlacementRecord[],
  minBp?: number,
) {
  return composeLaneLinks({
    upper,
    lower,
    upperAssemblyName: 'genomeB',
    lowerAssemblyName: 'genomeC',
    minBp,
  })
}

function shape(link: { get: (k: string) => unknown }) {
  const mate = link.get('mate') as Mate
  return {
    refName: link.get('refName'),
    start: link.get('start'),
    end: link.get('end'),
    strand: link.get('strand'),
    mate,
  }
}

describe('composeLaneLinks', () => {
  it('links two + records fully overlapping on the anchor with exact coordinates', () => {
    const links = compose(
      [record('b', [5000, 15000], ['bctg1', 0, 10000])],
      [record('c', [8000, 20000], ['cctg1', 1000, 13000])],
    )
    expect(links.length).toBe(1)
    const link = links[0]!
    expect(shape(link)).toEqual({
      refName: 'bctg1',
      start: 3000,
      end: 10000,
      strand: 1,
      mate: {
        assemblyName: 'genomeC',
        refName: 'cctg1',
        start: 1000,
        end: 8000,
      },
    })
    expect(link.get('assemblyName')).toBe('genomeB')
    expect(link.get('composedThrough')).toEqual({
      refName: 'chr1',
      start: 8000,
      end: 15000,
    })
    expect(link.id()).toBe('composed:b@0-10000|c@1000-13000|chr1:8000-15000')
  })

  it('maps a -1 record from the far end, and the link strand is the product', () => {
    const links = compose(
      [record('b', [10000, 16000], ['bctg2', 2000, 8000], -1)],
      [record('c', [12000, 14000], ['cctg2', 500, 2500])],
    )
    expect(links.map(shape)).toEqual([
      {
        refName: 'bctg2',
        start: 4000,
        end: 6000,
        strand: -1,
        mate: {
          assemblyName: 'genomeC',
          refName: 'cctg2',
          start: 500,
          end: 2500,
        },
      },
    ])
    const both = compose(
      [record('b', [0, 100], ['b', 0, 100], -1)],
      [record('c', [0, 100], ['c', 0, 100], -1)],
    )
    expect(both[0]!.get('strand')).toBe(1)
  })

  it('scales an intersection into a lane whose record spans a different length', () => {
    const links = compose(
      [record('b', [0, 1000], ['b', 0, 2000])],
      [record('c', [250, 750], ['c', 100, 200])],
    )
    expect(links.map(shape)).toEqual([
      {
        refName: 'b',
        start: 500,
        end: 1500,
        strand: 1,
        mate: { assemblyName: 'genomeC', refName: 'c', start: 100, end: 200 },
      },
    ])
  })

  it('links every partially overlapping pair once and nothing else', () => {
    const links = compose(
      [
        record('b1', [0, 100], ['b', 0, 100]),
        record('b2', [150, 250], ['b', 1000, 1100]),
        record('b3', [300, 400], ['b', 2000, 2100]),
      ],
      [
        record('c1', [50, 200], ['c', 0, 150]),
        record('c2', [260, 290], ['c', 500, 530]),
        record('c3', [350, 500], ['c', 700, 850]),
      ],
    )
    expect(
      links.map(
        l => l.get('composedThrough') as { start: number; end: number },
      ),
    ).toEqual([
      { refName: 'chr1', start: 50, end: 100 },
      { refName: 'chr1', start: 150, end: 200 },
      { refName: 'chr1', start: 350, end: 400 },
    ])
    expect(links.map(shape)).toEqual([
      {
        refName: 'b',
        start: 50,
        end: 100,
        strand: 1,
        mate: { assemblyName: 'genomeC', refName: 'c', start: 0, end: 50 },
      },
      {
        refName: 'b',
        start: 1000,
        end: 1050,
        strand: 1,
        mate: { assemblyName: 'genomeC', refName: 'c', start: 100, end: 150 },
      },
      {
        refName: 'b',
        start: 2050,
        end: 2100,
        strand: 1,
        mate: { assemblyName: 'genomeC', refName: 'c', start: 700, end: 750 },
      },
    ])
  })

  it('emits nothing for a record with no partner, an abutting one, or a different anchor contig', () => {
    expect(compose([record('b', [0, 100], ['b', 0, 100])], [])).toEqual([])
    expect(
      compose(
        [record('b', [0, 100], ['b', 0, 100])],
        [record('c', [100, 200], ['c', 0, 100])],
      ),
    ).toEqual([])
    expect(
      compose(
        [record('b', [0, 100], ['b', 0, 100], 1, 'chr1')],
        [record('c', [0, 100], ['c', 0, 100], 1, 'chr2')],
      ),
    ).toEqual([])
  })

  it('does not accept input order as significant', () => {
    const upper = [
      record('b2', [150, 250], ['b', 1000, 1100]),
      record('b1', [0, 100], ['b', 0, 100]),
    ]
    const lower = [
      record('c2', [200, 300], ['c', 0, 100]),
      record('c1', [50, 120], ['c', 500, 570]),
    ]
    expect(compose(upper, lower).map(l => l.id())).toEqual(
      compose([...upper].reverse(), [...lower].reverse()).map(l => l.id()),
    )
  })

  it('skips intersections under minBp', () => {
    const upper = [record('b', [0, 100], ['b', 0, 100])]
    const lower = [record('c', [95, 200], ['c', 0, 105])]
    expect(compose(upper, lower).length).toBe(1)
    expect(compose(upper, lower, 10)).toEqual([])
  })

  it('stays near-linear over many records', () => {
    const n = 200_000
    const upper: LanePlacementRecord[] = []
    const lower: LanePlacementRecord[] = []
    for (let k = 0; k < n; k++) {
      const at = k * 100
      upper.push(record(`b${k}`, [at, at + 60], ['b', at, at + 60]))
      lower.push(record(`c${k}`, [at + 30, at + 90], ['c', at, at + 60]))
    }
    const started = performance.now()
    const links = compose(upper, lower)
    const elapsed = performance.now() - started
    expect(links.length).toBe(n)
    expect(elapsed).toBeLessThan(3000)
  })
})
