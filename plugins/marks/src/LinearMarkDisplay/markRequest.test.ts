import { runTransforms } from '@jbrowse/core/util/featureTransforms'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { configSchemaFactory } from './configSchema.ts'
import { markLayerRequest, stepsOf } from './markRequest.ts'
import { stepChannels } from './stepChannels.ts'

function markOf(mark: Record<string, unknown>) {
  return configSchemaFactory().create({ displayId: 'd', marks: [mark] })
    .marks[0]!
}

test('only a mark with a far foot reaches the other end a mate step found', () => {
  const channels = stepChannels([{ type: 'mate' }])
  const span = markLayerRequest(markOf({ mark: 'span' }), channels, 1)
  expect(span.encoding.x2).toBe('end')
  const link = markLayerRequest(markOf({ mark: 'link' }), channels, 1)
  expect(link.encoding.x2).toEqual({ chrom: 'mate.refName', pos: 'mate.start' })
  const bnd = new SimpleFeature({
    uniqueId: 'bnd',
    refName: 'ctgA',
    start: 999,
    end: 1000,
    REF: 'N',
    ALT: ['N[ctgB:50000['],
  })
  const enc = encodeFeatures(
    runTransforms([bnd], [{ type: 'mate' }]),
    span.encoding,
    span.lanes,
  )
  expect([...enc.x2]).toEqual([1000])
})

test('a line asks for its series, split by a categorical color, and a stated gap', () => {
  const overlay = markLayerRequest(
    markOf({
      mark: 'line',
      encoding: { y: 'score', color: { field: 'source' } },
      gapBp: 20000,
    }),
    {},
    1,
  )
  expect(overlay.lanes).toContain('series')
  expect(overlay.path).toEqual({ by: 'source', gapBp: 20000 })
  const ramp = markLayerRequest(
    markOf({
      mark: 'line',
      encoding: { y: 'score', color: { field: 'score', scale: 'linear' } },
    }),
    {},
    1,
  )
  expect(ramp.path).toEqual({})
  const bar = markLayerRequest(
    markOf({ mark: 'bar', encoding: { y: 'score' } }),
    {},
    1,
  )
  expect(bar.path).toBeUndefined()
  expect(bar.lanes).not.toContain('series')
})

test("a window's frame reaches the worker as written, or its default where the rule list refuses it", () => {
  const frameOf = (frame: unknown) => {
    const [step] = stepsOf(
      markOf({
        mark: 'line',
        encoding: { y: 'mean_score' },
        transform: [
          {
            type: 'window',
            ...(frame === undefined ? {} : { frame }),
            ops: [{ op: 'mean', field: 'score' }],
          },
        ],
      }).transform,
      1,
    )
    return step?.type === 'window' ? step.frame : undefined
  }
  expect(frameOf(undefined)).toEqual([-10, 10])
  expect(frameOf([null, 0])).toEqual([null, 0])
  expect(frameOf([-10, '10'])).toEqual([-10, 10])
  expect(frameOf([5, -5])).toEqual([-10, 10])
})

test('an emptied step slot leaves the worker its default, which the channel reader assumed', () => {
  const mark = markOf({
    mark: 'span',
    transform: [
      { type: 'coverage', as: '' },
      { type: 'pileup', as: '' },
      { type: 'formula', expr: 'jexl:1', as: '' },
      { type: 'flatten', field: '', index: '' },
      { type: 'bin', step: 10, field: '' },
    ],
  })
  expect(stepsOf(mark.transform, 1)).toEqual([
    { type: 'coverage', as: 'coverage' },
    { type: 'pileup', as: 'row', fields: ['start', 'end'], padding: 0 },
    { type: 'formula', expr: 'jexl:1', as: 'value' },
    {
      type: 'flatten',
      field: 'subfeatures',
      index: '',
      key: '',
      keepEmpty: false,
    },
    { type: 'bin', step: 10, field: 'start', as: ['start', 'end'] },
  ])
  const reads = [
    new SimpleFeature({ uniqueId: 'a', refName: 'ctgA', start: 0, end: 100 }),
    new SimpleFeature({ uniqueId: 'b', refName: 'ctgA', start: 50, end: 150 }),
  ]
  const covered = markOf({
    mark: 'bar',
    transform: [{ type: 'coverage', as: '' }],
  })
  const out = runTransforms(reads, stepsOf(covered.transform, 1))
  const channels = stepChannels(covered.transform)
  const enc = encodeFeatures(out, { y: channels.y }, ['y'])
  expect(enc.count).toBe(3)
  expect(enc.skipped).toBe(0)
})
