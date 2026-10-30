import { parseLines, parseLinesLazy } from '@gmod/gff-nostream'
import { featureBedColor } from '@jbrowse/core/util/colorBits'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { Gff3Feature } from './Gff3Feature.ts'

import type { Feature } from '@jbrowse/core/util/simpleFeature'

const GENE = [
  'ctgA\texample\tgene\t1051\t9000\t.\t+\t.\tID=gene1;Name=EDEN;Note=protein%20kinase;gbkey=Gene',
  'ctgA\texample\tmRNA\t1051\t9000\t.\t+\t.\tID=mRNA1;Parent=gene1;Name=EDEN.1',
  'ctgA\texample\texon\t1051\t1500\t.\t+\t.\tParent=mRNA1',
  'ctgA\texample\tCDS\t1201\t1500\t.\t+\t0\tParent=mRNA1',
]

/**
 * The same lines through the eager parser and SimpleFeature — what the adapter
 * built before. Every assertion about the lazy feature is made against this, so
 * the two cannot drift.
 */
function eager(lines: string[]): Feature {
  const [f] = parseLines(lines)
  return new SimpleFeature({ data: f!, id: 'test-0' })
}

function lazy(lines: string[]): Feature {
  const [f] = parseLinesLazy(lines)
  return new Gff3Feature(f!, 'test-0')
}

describe('Gff3Feature', () => {
  it('serializes identically to the eager SimpleFeature path', () => {
    expect(lazy(GENE).toJSON()).toEqual(eager(GENE).toJSON())
  })

  it.each([
    'start',
    'end',
    'type',
    'refName',
    'source',
    'score',
    'phase',
    'strand',
  ])('reads column %s the same as SimpleFeature', col => {
    expect(lazy(GENE).get(col)).toEqual(eager(GENE).get(col))
  })

  it.each(['name', 'id', 'note', 'gbkey', 'absent'])(
    'resolves attribute %s the same as SimpleFeature',
    attr => {
      expect(lazy(GENE).get(attr)).toEqual(eager(GENE).get(attr))
    },
  )

  it('answers a repeated attribute read the same, hit or miss', () => {
    const f = lazy([
      'ctgA\texample\tgene\t1051\t9000\t.\t+\t.\tID=gene1;Alias=a,b',
    ])
    expect(f.get('alias')).toBe(f.get('alias'))
    expect(f.get('alias')).toEqual(['a', 'b'])
    expect(f.get('reserved')).toBeUndefined()
    expect(f.get('reserved')).toBeUndefined()
  })

  // what "Save track data" writes for a BED12, a bigBed and a BED9 feature
  it.each(['itemRgb', 'reserved', 'field8'])(
    'reads back a BED color exported as %s',
    tag => {
      const f = lazy([
        `ctgA\texample\tmRNA\t1051\t9000\t.\t+\t.\tID=m1;${tag}=227%2C26%2C28`,
      ])
      expect(featureBedColor(f)).toBe('227,26,28')
    },
  )

  it('has no BED color without one of those attributes', () => {
    expect(featureBedColor(lazy(GENE))).toBeUndefined()
    expect(featureBedColor(lazy(GENE), true)).toBeUndefined()
  })

  it('treats an exported black as unset unless itemRgbOn, as BED does', () => {
    const f = lazy([
      'ctgA\texample\tmRNA\t1051\t9000\t.\t+\t.\tID=m1;itemRgb=0%2C0%2C0',
    ])
    expect(featureBedColor(f)).toBeUndefined()
    expect(featureBedColor(f, true)).toBe('0,0,0')
  })

  it('unescapes a deferred attribute only when asked for it', () => {
    expect(lazy(GENE).get('note')).toBe('protein kinase')
  })

  it('nests children with the same ids the eager path used', () => {
    const kids = lazy(GENE).children!()!
    expect(kids.map(k => k.id())).toEqual(['test-0-0'])
    expect(kids[0]!.children!()!.map(k => k.id())).toEqual([
      'test-0-0-0',
      'test-0-0-1',
    ])
  })

  it('links a child back to its parent', () => {
    const gene = lazy(GENE)
    const mrna = gene.children!()![0]!
    expect(mrna.parent!()).toBe(gene)
    expect(mrna.get('parent')).toBe(gene)
  })

  // '.' in the strand column parses to 0 — an explicit "no strand" — not to
  // absent, so it does *not* inherit. The parent-strand fallback both this and
  // SimpleFeature carry is therefore near-unreachable from GFF3: a line short
  // enough to omit column 7 also omits column 9, so it can carry no Parent and
  // can never be a child. Pinned as parity rather than as behaviour anyone
  // should rely on.
  it('treats a "." strand as 0 rather than inheriting, as SimpleFeature does', () => {
    const lines = [
      'ctgA\tex\tgene\t1\t100\t.\t-\t.\tID=g1',
      'ctgA\tex\texon\t1\t50\t.\t.\t.\tParent=g1',
    ]
    const child = lazy(lines).children!()![0]!
    expect(child.get('strand')).toBe(
      eager(lines).children!()![0]!.get('strand'),
    )
    expect(child.get('strand')).toBe(0)
  })

  it('reports the same tags as SimpleFeature, ignoring order', () => {
    expect([...(lazy(GENE) as Gff3Feature).tags()].sort()).toEqual(
      [...(eager(GENE) as SimpleFeature).tags()].sort(),
    )
  })

  it('keeps an empty subfeature list empty rather than undefined', () => {
    const lines = ['ctgA\tex\tgene\t1\t100\t.\t+\t.\tID=g1']
    expect(lazy(lines).toJSON().subfeatures).toEqual([])
    expect(lazy(lines).toJSON()).toEqual(eager(lines).toJSON())
  })

  it('carries parentId into a child’s serialized form, as SimpleFeature does', () => {
    const lazyChild = lazy(GENE).children!()![0]!.toJSON()
    const eagerChild = eager(GENE).children!()![0]!.toJSON()
    expect(lazyChild.parentId).toBe(eagerChild.parentId)
  })

  it('keys its file attributes as the file writes them, every value a list', () => {
    const [f] = parseLinesLazy([
      'ctgA\tx\tgene\t1\t9\t.\t+\t.\tID=g1;Name=EDEN;Dbxref=a:1,b%2C2;start=4;note=x%3By',
    ])
    expect(new Gff3Feature(f!, 'test-0').fileAttributes()).toEqual({
      ID: ['g1'],
      Name: ['EDEN'],
      Dbxref: ['a:1', 'b,2'],
      start: ['4'],
      note: ['x;y'],
    })
    expect(lazy(GENE).get('id')).toBe('gene1')
  })
})
