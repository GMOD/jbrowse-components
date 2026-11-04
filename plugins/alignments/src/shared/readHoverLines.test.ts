import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'

import { buildReadMateLines, buildReadTooltipValues } from './readHoverLines.ts'

const { jexl } = new PluginManager()

// a gene pair as an MCScan anchors file gives it: the query side's gene, and
// the ortholog with its locus as `mate`
const anchor = new SimpleFeature({
  uniqueId: 'a',
  refName: 'chr10',
  start: 121_478_000,
  end: 121_598_000,
  name: 'FGFR2',
  mate: {
    name: 'Fgfr2',
    refName: 'chr7',
    start: 129_764_000,
    end: 129_868_000,
    assemblyName: 'mm39',
  },
})

// a PAF block: no name on either side
const pafBlock = new SimpleFeature({
  uniqueId: 'b',
  refName: 'chr1',
  start: 0,
  end: 1000,
  mate: { refName: 'chr2', start: 5000, end: 6000, assemblyName: 'mm39' },
})

const plain = new SimpleFeature({
  uniqueId: 'c',
  refName: 'chr1',
  start: 0,
  end: 10,
  name: 'read1',
})

test('a path reads the ortholog off the mate', () => {
  expect(buildReadTooltipValues([anchor, pafBlock], 'mate.name', jexl)).toEqual(
    ['Fgfr2', ''],
  )
})

test("AGR's v4 mouseover expression reads the ortholog", () => {
  expect(
    buildReadTooltipValues([anchor], "jexl:get(feature,'mate').name", jexl),
  ).toEqual(['Fgfr2'])
})

test('a field nothing answers ships no column', () => {
  expect(
    buildReadTooltipValues([pafBlock, plain], 'mate.name', jexl),
  ).toBeUndefined()
})

test('a jexl function no longer registered reads nothing rather than throwing', () => {
  expect(
    buildReadTooltipValues([anchor], 'jexl:lgvSyntenyTooltip(feature)', jexl),
  ).toBeUndefined()
})

test('a field the first read throws on is read no further', () => {
  const read = jest.fn(() => {
    throw new Error('Jexl Function lgvSyntenyTooltip is not defined.')
  })
  jexl.addFunction('throwsForTest', read)
  expect(
    buildReadTooltipValues(
      [anchor, pafBlock, plain],
      'jexl:throwsForTest(feature)',
      jexl,
    ),
  ).toBeUndefined()
  expect(read).toHaveBeenCalledTimes(1)
})

test('an expression that does not compile reads nothing', () => {
  expect(buildReadTooltipValues([anchor], 'jexl:get(feature,', jexl)).toBe(
    undefined,
  )
})

test("a numeric 0 is the read's value, not an empty one", () => {
  const read = new SimpleFeature({
    uniqueId: 'd',
    refName: 'chr1',
    start: 0,
    end: 10,
    hp: 0,
  })
  expect(buildReadTooltipValues([read], 'hp', jexl)).toEqual(['0'])
})

test('the mate line names the ortholog, its assembly and its span', () => {
  expect(buildReadMateLines([anchor, pafBlock])).toEqual([
    'Fgfr2 mm39 chr7:129,764,001-129,868,000',
    'mm39 chr2:5,001-6,000',
  ])
})

test('reads with no mate ship no mate lines', () => {
  expect(buildReadMateLines([plain])).toBeUndefined()
})
