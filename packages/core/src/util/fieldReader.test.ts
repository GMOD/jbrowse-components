import { fieldReader, plainFieldName } from './fieldReader.ts'
import createJexlInstance from './jexl.ts'
import { stringToJexlExpression } from './jexlStrings.ts'
import SimpleFeature, { buildJexlContext } from './simpleFeature.ts'

const jexl = createJexlInstance()

const variant = new SimpleFeature({
  uniqueId: 'v1',
  refName: 'chr1',
  start: 0,
  end: 1,
  type: 'deletion',
  INFO: { SVTYPE: ['DEL'], nested: { depth: 3 }, AF: [0.5], 'AF.EAS': [0.3] },
  'gene.version': '7',
})

test('a name reads the field', () => {
  expect(fieldReader('type', jexl)(variant)).toBe('deletion')
})

test('a dotted path reads into a structured field', () => {
  expect(fieldReader('INFO.SVTYPE', jexl)(variant)).toEqual(['DEL'])
  expect(fieldReader('INFO.nested.depth', jexl)(variant)).toBe(3)
  expect(fieldReader('INFO.absent', jexl)(variant)).toBeUndefined()
  expect(fieldReader('type.length', jexl)(variant)).toBeUndefined()
})

test('a field whose name has a dot wins over the path', () => {
  expect(fieldReader('gene.version', jexl)(variant)).toBe('7')
})

// VCF 4.3 allows a dot in an INFO key, beside the key it extends
test('a key whose name has a dot is read whole at any depth of the path', () => {
  expect(fieldReader('INFO.AF.EAS', jexl)(variant)).toEqual([0.3])
  expect(fieldReader('INFO.AF', jexl)(variant)).toEqual([0.5])
})

test('a jexl expression reads over feature, and one that does not compile throws once', () => {
  expect(fieldReader("jexl:get(feature,'type') + '!'", jexl)(variant)).toBe(
    'deletion!',
  )
  expect(() => fieldReader('jexl:feature.type ==', jexl)).toThrow()
})

test.each([
  ['score', 'score'],
  ['INFO.DP', undefined],
  ['jexl:feature.score', 'score'],
  ["jexl:feature['score']", 'score'],
  ["jexl:get(feature, 'score')", 'score'],
  ["jexl:get(feature, 'parent')", 'parent'],
  ['jexl:feature.parent', undefined],
  ['jexl:feature.uniqueId', undefined],
  ['jexl:feature.INFO.DP', undefined],
  ["jexl:feature['INFO.DP']", undefined],
  ['jexl:feature[0]', undefined],
  ['jexl:feature[key]', undefined],
  ['jexl:score', undefined],
  ['jexl:feature.score * 2', undefined],
  ["jexl:get(feature, 'a', 'b')", undefined],
  ['jexl:feature.', undefined],
])('plainFieldName(%p) is %p', (ref, name) => {
  expect(plainFieldName(ref)).toBe(name)
})

test('a jexl ref that only reads a field reads it as the name does', () => {
  expect(fieldReader('jexl:feature.type', jexl)(variant)).toBe('deletion')
  expect(fieldReader('jexl:feature.type', undefined)(variant)).toBe('deletion')
})

const featureWith = (data: Record<string, unknown>) =>
  new SimpleFeature({
    uniqueId: 'u',
    refName: 'chr1',
    start: 0,
    end: 1,
    ...data,
  })

const nameOrId = "jexl:get(feature,'name') || get(feature,'id')"
const descriptionChain =
  "jexl:get(feature,'note') || get(feature,'description') || get(feature,'function')"

const throughJexl = (ref: string, feature: SimpleFeature) =>
  stringToJexlExpression(ref, jexl).eval(buildJexlContext({ feature }))

describe('a chain of || over plain field reads', () => {
  test('reads natively, without a jexl instance', () => {
    expect(fieldReader(nameOrId, undefined)(featureWith({ name: 'a' }))).toBe(
      'a',
    )
  })

  test.each([
    ['the first when truthy', { name: 'n', id: 'i' }, 'n'],
    ['the second when the first is absent', { id: 'i' }, 'i'],
    ['the second when the first is empty', { name: '', id: 'i' }, 'i'],
    ['the second when the first is 0', { name: 0, id: 'i' }, 'i'],
    ['the second when the first is null', { name: null, id: 'i' }, 'i'],
    ['the last term when all are falsy', { name: '', id: 0 }, 0],
    ['the last term when it is empty', { name: 0, id: '' }, ''],
    ['the last term when it is null', { name: '', id: null }, null],
    ['undefined when all are absent', {}, undefined],
  ])('answers %s', (_label, data, expected) => {
    const feature = featureWith(data)
    expect(fieldReader(nameOrId, jexl)(feature)).toStrictEqual(expected)
    expect(throughJexl(nameOrId, feature)).toStrictEqual(expected)
  })

  test.each([
    [{ note: 'n', description: 'd', function: 'f' }],
    [{ description: 'd', function: 'f' }],
    [{ note: '', description: '', function: 'f' }],
    [{ note: 0, description: null, function: 'f' }],
    [{ function: 'f' }],
    [{ note: '', description: 0 }],
    [{}],
  ])('a three-term chain matches jexl for %p', data => {
    const feature = featureWith(data)
    expect(fieldReader(descriptionChain, jexl)(feature)).toStrictEqual(
      throughJexl(descriptionChain, feature),
    )
  })

  test('a term written as feature.x reads like get', () => {
    expect(
      fieldReader(
        'jexl:feature.name || feature.id',
        undefined,
      )(featureWith({ name: '', id: 'i' })),
    ).toBe('i')
  })
})

describe('a chain with a term that is not a plain field read goes through jexl', () => {
  test.each([
    "jexl:get(feature,'a') || get(feature,'b') + 1",
    "jexl:get(feature,'a') || floor(get(feature,'b'))",
    "jexl:get(feature,'a') || get(feature,'b', 'c')",
    "jexl:get(feature,'a') || 'none'",
    "jexl:get(feature,'a') && get(feature,'b')",
    "jexl:get(feature,'a') ?? get(feature,'b')",
    "jexl:get(feature,'a') || feature.INFO.DP",
    "jexl:get(feature,'a') || feature.uniqueId",
  ])('%s', ref => {
    expect(() => fieldReader(ref, undefined)).toThrow('needs a jexl instance')
    for (const data of [
      { a: 'x', b: 2 },
      { a: '', b: 2.6, INFO: { DP: 7 } },
      { a: 0, b: 3 },
      {},
    ]) {
      const feature = featureWith(data)
      expect(fieldReader(ref, jexl)(feature)).toStrictEqual(
        throughJexl(ref, feature),
      )
    }
  })
})
