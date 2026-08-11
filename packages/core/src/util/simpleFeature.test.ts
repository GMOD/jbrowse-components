import createJexlInstance from './jexl.ts'
import { stringToJexlExpression } from './jexlStrings.ts'
import SimpleFeature, {
  isFeature,
  jexlFeatureProxy,
  unwrapFeature,
} from './simpleFeature.ts'

import type { Feature } from './simpleFeature.ts'

const jexl = createJexlInstance()

test('can create a simple feature', () => {
  const f = new SimpleFeature({
    uniqueId: 'test',
    refName: 't1',
    start: 100,
    end: 200,
  })
  expect(f.id()).toEqual('test')
  expect(f.get('start')).toEqual(100)
  expect(f.get('end')).toEqual(200)
})

test('can create a simple with subfeatures', () => {
  const f = new SimpleFeature({
    uniqueId: 'test',
    refName: 't1',
    start: 100,
    end: 500,
    subfeatures: [
      { refName: 't1', start: 100, end: 200 },
      { refName: 't1', start: 400, end: 500 },
    ],
  })
  expect(f.id()).toEqual('test')
  expect(f.get('start')).toEqual(100)
  expect(f.get('end')).toEqual(500)
  expect(f.get('subfeatures')![0]!.get('start')).toEqual(100)
})

// A subfeature with no strand of its own inherits its parent's. That used to be
// a copy made in the constructor — the whole subfeature spread to set one field
// — and is now resolved through the parent handle at read time, which puts two
// things at risk that the copy got for free: inheritance through more than one
// level, and a subfeature that has been serialized and rebuilt with no parent
// to inherit from.
describe('strand inheritance', () => {
  const gene = () =>
    new SimpleFeature({
      uniqueId: 'gene1',
      refName: 'chr1',
      start: 100,
      end: 900,
      strand: -1,
      subfeatures: [
        {
          refName: 'chr1',
          start: 100,
          end: 500,
          type: 'mRNA',
          subfeatures: [
            { refName: 'chr1', start: 100, end: 200, type: 'exon' },
            { refName: 'chr1', start: 300, end: 400, type: 'exon', strand: 1 },
          ],
        },
      ],
    })

  const strands = (f: Feature): (number | undefined)[] => [
    f.get('strand'),
    ...(f.get('subfeatures') ?? []).flatMap(k => strands(k)),
  ]

  it('reaches a grandchild through a parent that inherited too', () => {
    // the mRNA has no strand of its own, so the exon under it inherits through
    // a link that is itself resolved rather than stored
    expect(strands(gene())).toEqual([-1, -1, -1, 1])
  })

  it('survives serialization, which is what crosses the RPC boundary', () => {
    // rebuilt from JSON, so no feature in the tree has a parent handle: the
    // inherited value has to have been baked into the serialized form
    const json = JSON.parse(JSON.stringify(gene().toJSON()))
    expect(strands(new SimpleFeature(json))).toEqual([-1, -1, -1, 1])
  })

  it('leaves a feature with no strand anywhere undefined', () => {
    const f = new SimpleFeature({
      uniqueId: 'x',
      refName: 'chr1',
      start: 1,
      end: 10,
      subfeatures: [{ refName: 'chr1', start: 1, end: 5 }],
    })
    expect(strands(f)).toEqual([undefined, undefined])
  })
})

test('rejects missing and inverted coordinates', () => {
  expect(
    () => new SimpleFeature({ uniqueId: 'test', refName: 't1' } as never),
  ).toThrow(/start and end must be numbers/)
  expect(
    () =>
      new SimpleFeature({
        uniqueId: 'test',
        refName: 't1',
        start: Number.NaN,
        end: 5,
      }),
  ).toThrow(/invalid feature data/)
  expect(
    () =>
      new SimpleFeature({
        uniqueId: 'test',
        refName: 't1',
        start: 10,
        end: 5,
      }),
  ).toThrow(/end less than start/)
})

test('coordinate-free refName alias records are exempt, aliased features are not', () => {
  expect(() =>
    new SimpleFeature({
      uniqueId: 'ctgA',
      refName: 'ctgA',
      aliases: ['contigA'],
    } as never).get('aliases'),
  ).not.toThrow()
  expect(
    () =>
      new SimpleFeature({
        uniqueId: 'test',
        refName: 't1',
        aliases: ['other'],
        start: 10,
        end: 5,
      }),
  ).toThrow(/end less than start/)
})

describe('jexlFeatureProxy', () => {
  const f = new SimpleFeature({
    uniqueId: 'test',
    refName: 't1',
    start: 100,
    end: 200,
    type: 'gene',
    score: 9,
    INFO: { SVTYPE: 'DEL' },
  })
  // exercise the real path: member access inside a compiled jexl expression
  const ev = (code: string, feature: SimpleFeature) =>
    stringToJexlExpression(`jexl:${code}`, jexl).eval({
      feature: jexlFeatureProxy(feature),
    })

  test('reads attributes as plain properties', () => {
    expect(ev('feature.start', f)).toEqual(100)
    expect(ev('feature.type', f)).toEqual('gene')
    expect(ev('feature.score', f)).toEqual(9)
    expect(ev('feature.missing', f)).toBeUndefined()
  })

  test('nested attributes', () => {
    expect(ev('feature.INFO.SVTYPE', f)).toEqual('DEL')
  })

  test('feature.id reads the data field (e.g. GFF3 ID=), same as get', () => {
    const g = new SimpleFeature({
      uniqueId: 'uid',
      refName: 't1',
      start: 0,
      end: 1,
      id: 'gff-id',
    })
    expect(ev('feature.id', g)).toEqual('gff-id')
    expect(ev("get(feature,'id')", g)).toEqual('gff-id')
    // ...while the id() function and feature.uniqueId stay the identity, even
    // though a data `id` field shadows the property
    expect(ev('id(feature)', g)).toEqual('uid')
    expect(ev('feature.uniqueId', g)).toEqual('uid')
  })

  test('uniqueId/id() do not depend on the construction form', () => {
    const fromArgs = new SimpleFeature({
      id: 'uid',
      data: { refName: 't1', start: 0, end: 1 },
    })
    expect(ev('id(feature)', fromArgs)).toEqual('uid')
    expect(ev('feature.uniqueId', fromArgs)).toEqual('uid')
  })

  test('proxy is a Feature, is idempotent, and serializes', () => {
    const p = jexlFeatureProxy(f)
    expect(isFeature(p)).toBe(true)
    expect(jexlFeatureProxy(p)).toBe(p)
    expect(JSON.parse(JSON.stringify(p))).toEqual(f.toJSON())
  })

  // isFeature accepts a proxy, but the Feature type it narrows to promises a
  // callable id(); on a proxy `id` is a data field. Anything holding onto a
  // feature past a jexl callback has to unwrap first — BaseSession.setSelection
  // does, because five `isFeature(selection) ? selection.id() : …` readers
  // would otherwise throw.
  test('id is a data field on the proxy, a method on the unwrapped feature', () => {
    const p = jexlFeatureProxy(f)
    expect(typeof (p as unknown as Record<string, unknown>).id).not.toBe(
      'function',
    )
    expect(unwrapFeature(p).id()).toBe(f.id())
  })

  test('parent()/id() also work on an unwrapped feature', () => {
    const parent = new SimpleFeature({
      uniqueId: 'p',
      refName: 't1',
      start: 0,
      end: 1000,
      type: 'mRNA',
    })
    const child = new SimpleFeature({
      id: 'c',
      data: { refName: 't1', start: 100, end: 200 },
      parent,
    })
    const raw = (code: string) =>
      stringToJexlExpression(`jexl:${code}`, jexl).eval({ feature: child })
    expect(raw('parent(feature).type')).toEqual('mRNA')
    expect(raw('id(feature)')).toEqual('c')
  })

  test('legacy get/getTag/parent functions still work through the proxy', () => {
    expect(ev("get(feature,'type')", f)).toEqual('gene')
    expect(ev("get(feature,'start')", f)).toEqual(100)
    const parent = new SimpleFeature({
      uniqueId: 'p',
      refName: 't1',
      start: 0,
      end: 1000,
      type: 'mRNA',
    })
    const child = new SimpleFeature({
      id: 'c',
      data: { refName: 't1', start: 100, end: 200 },
      parent,
    })
    expect(ev("get(parent(feature),'type')", child)).toEqual('mRNA')
  })

  test('object-literal lookup by attribute', () => {
    expect(ev("{gene:'blue',CDS:'red'}[feature.type] || 'gray'", f)).toEqual(
      'blue',
    )
  })

  test('parent is re-wrapped so nested property access works', () => {
    const parent = new SimpleFeature({
      uniqueId: 'p',
      refName: 't1',
      start: 0,
      end: 1000,
      type: 'mRNA',
    })
    const child = new SimpleFeature({
      id: 'c',
      data: { refName: 't1', start: 100, end: 200 },
      parent,
    })
    expect(ev('feature.parent.type', child)).toEqual('mRNA')
  })
})
