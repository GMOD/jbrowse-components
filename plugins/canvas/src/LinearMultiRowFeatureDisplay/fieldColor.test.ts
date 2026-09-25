import { setConf } from '@jbrowse/core/configuration'
import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { autorun } from 'mobx'

import { packMultiRowFeatures } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

const SEGMENTS = [
  { sample: 'T1', segmean: -1.4 },
  { sample: 'T1', segmean: 0.1 },
  { sample: 'T2', segmean: 1.8 },
  { sample: 'T2', segmean: undefined },
].map(
  (attrs, i) =>
    new SimpleFeature({
      uniqueId: `s${i}`,
      refName: 'ctgA',
      start: i * 100,
      end: i * 100 + 50,
      ...attrs,
    }),
)

function pack(field: string): MultiRowRegionData {
  return packMultiRowFeatures({
    features: SEGMENTS,
    partitionField: 'sample',
    lengthField: '',
    colorConfig: { value: undefined, field },
    jexl: createJexlInstance(),
  })
}

const THRESHOLD = {
  field: 'segmean',
  scale: 'threshold',
  domain: ['-1', '1'],
  range: ['#0000ff', '#eeeeee', '#ff0000'],
  labels: ['Loss', 'Balanced', 'Gain'],
  title: 'Copy number',
}

test('the worker ships each feature its field value, and each value its row', () => {
  const data = pack('segmean')
  expect(data.colorValues).toEqual({
    field: 'segmean',
    values: ['-1.4', '0.1', '1.8', ''],
    painted: [
      { rowIndex: 0, valueIndex: 0 },
      { rowIndex: 0, valueIndex: 1 },
      { rowIndex: 1, valueIndex: 2 },
      { rowIndex: 1, valueIndex: 3 },
    ],
  })
  expect([...data.featureColorValues!]).toEqual([1, 2, 3, 4])
  expect(pack('').colorValues).toBeUndefined()
})

describe('a colour field on the multi-row display', () => {
  function display() {
    const env = createTestEnvironment({
      displayConfig: { rows: 'sample', color: THRESHOLD },
    }).createDisplay()
    env.display.setRpcData(0, pack('segmean'), ctgA)
    return env.display
  }

  it('paints each block its bin, and one with no value the no-value grey', () => {
    const d = display()
    const held = autorun(() => {
      void d.encodedChannels
    })
    const { color, count } = [...d.encodedChannels.values()][0]!
    expect([...color.subarray(0, count)]).toEqual(
      ['#0000ff', '#eeeeee', '#ff0000']
        .map(c => cssColorToABGR(c))
        .concat(color[3]!),
    )
    held()
  })

  it('keys the bins by their labels, under the colour title', () => {
    const d = display()
    const [section] = d.legendSpec.sections
    expect(section?.title).toBe('Copy number')
    expect(section?.items.map(i => i.label)).toEqual([
      'Loss',
      'Balanced',
      'Gain',
      '(no value)',
    ])
  })

  it('hides a bin from the painting when its key row is toggled off', () => {
    const d = display()
    d.toggleCategory(['≥ 1'])
    const { count } = [...d.encodedChannels.values()][0]!
    expect(count).toBe(3)
  })

  it('sends the worker the field alone, so a recolour is no refetch', () => {
    const d = display()
    const before = d.rpcProps()
    setConf(d, ['color', 'range'], ['black', 'grey', 'white'])
    setConf(d, ['color', 'labels'], [])
    expect(d.rpcProps()).toEqual(before)
    expect(before.colorConfig).toEqual({ value: undefined, field: 'segmean' })
  })

  it('clusters on the field the colour names', () => {
    expect(display().effectiveClusterField).toBe('segmean')
  })
})
