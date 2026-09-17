import { fieldReader } from './fieldReader.ts'
import createJexlInstance from './jexl.ts'
import SimpleFeature from './simpleFeature.ts'

const jexl = createJexlInstance()

const variant = new SimpleFeature({
  uniqueId: 'v1',
  refName: 'chr1',
  start: 0,
  end: 1,
  type: 'deletion',
  INFO: { SVTYPE: ['DEL'], nested: { depth: 3 } },
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

test('a jexl expression reads over feature, and one that does not compile throws once', () => {
  expect(fieldReader("jexl:get(feature,'type') + '!'", jexl)(variant)).toBe(
    'deletion!',
  )
  expect(() => fieldReader('jexl:feature.type ==', jexl)).toThrow()
})
