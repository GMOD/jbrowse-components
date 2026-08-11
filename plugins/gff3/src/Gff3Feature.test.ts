import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { parseLines, parseLinesLazy } from 'gff-nostream'

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
})
