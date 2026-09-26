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

// The ramp branch of this display's key had no test: `features` and
// `features-gaps` are the ids the legend dismisses and re-keys by, and the
// derivation they come from is shared with the feature display, which asks for
// `color`.
describe('a ramp colour on the multi-row display', () => {
  const RAMP = {
    field: 'segmean',
    scale: 'linear',
    range: ['#000000', '#ffffff'],
    title: 'Copy number',
  }

  function display() {
    const env = createTestEnvironment({
      displayConfig: { rows: 'sample', color: RAMP },
    }).createDisplay()
    env.display.setRpcData(0, pack('segmean'), ctgA)
    return env.display
  }

  it('keys the ramp under the scale ids this display asks for', () => {
    const d = display()
    const ramp = d.colorScales.find(scale => scale.kind === 'ramp')
    expect(ramp).toMatchObject({
      id: 'features',
      title: 'Copy number',
      extent: [-1.4, 1.8],
    })
    expect(ramp?.kind === 'ramp' && ramp.stops).toHaveLength(8)
    expect(
      d.colorScales.find(scale => scale.id === 'features-gaps'),
    ).toMatchObject({
      entries: [expect.objectContaining({ missing: true })],
    })
  })

  // The band stands in before anything is drawn, and a key over nothing names
  // a domain no reader can check against the picture.
  it('keys nothing while no feature has drawn', () => {
    const env = createTestEnvironment({
      displayConfig: { rows: 'sample', color: RAMP },
    }).createDisplay()
    expect(env.display.colorScales.some(scale => scale.kind === 'ramp')).toBe(
      false,
    )
  })
})
