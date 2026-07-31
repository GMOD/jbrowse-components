import createJexlInstance from './jexl.ts'
import { stringToJexlExpression } from './jexlStrings.ts'
import SimpleFeature, { isFeature, jexlFeatureProxy } from './simpleFeature.ts'

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
