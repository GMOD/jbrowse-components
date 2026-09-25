import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { autorun } from 'mobx'

import { packMultiRowFeatures } from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'
import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { WorkerColor } from '../RenderFeatureDataRPC/renderConfig.ts'

const STATES = [
  { sample: 'E001', itemRgb: '255,0,0' },
  { sample: 'E001', itemRgb: '0,128,0' },
  { sample: 'E002', itemRgb: '255,0,0' },
  { sample: 'E002', itemRgb: '255,255,255' },
].map(
  (attrs, i) =>
    new SimpleFeature({
      uniqueId: `s${i}`,
      refName: 'ctgA',
      start: i * 100,
      end: i * 100 + 50,
      name: `state${i}`,
      ...attrs,
    }),
)

const CHROMHMM = {
  scale: 'identity',
  domain: ['rgb(255,0,0)', 'rgb(0,128,0)', 'rgb(255,255,255)'],
  labels: ['1 Active TSS', '4 Strong transcription', '15 Quiescent / low'],
}

function loaded(color?: typeof CHROMHMM) {
  const { display } = createTestEnvironment({
    displayConfig: { rows: 'sample', ...(color ? { color } : {}) },
  }).createDisplay()
  const colorConfig: WorkerColor = display.workerColor
  display.setRpcData(
    0,
    packMultiRowFeatures({
      features: STATES,
      partitionField: 'sample',
      lengthField: '',
      colorConfig,
      jexl: createJexlInstance(),
    }),
    ctgA,
  )
  return display
}

function paintedColors(display: ReturnType<typeof loaded>) {
  const held = autorun(() => {
    void display.encodedChannels
  })
  const { color, count } = [...display.encodedChannels.values()][0]!
  held()
  return [...color.subarray(0, count)]
}

describe('an identity colour over a file that colours its own features', () => {
  it("paints every block the file's itemRgb, as an unset colour does", () => {
    const identity = paintedColors(loaded(CHROMHMM))
    expect(identity).toEqual(paintedColors(loaded()))
    expect(new Set(identity)).toEqual(
      new Set(
        ['rgb(255,0,0)', 'rgb(0,128,0)', 'rgb(255,255,255)'].map(c =>
          cssColorToABGR(c),
        ),
      ),
    )
  })

  it('names each colour in the key by its label, in domain order', () => {
    const [section] = loaded(CHROMHMM).legendSpec.sections
    expect(section?.items.map(i => [i.label, i.color])).toEqual([
      ['1 Active TSS', 'rgba(255,0,0,1)'],
      ['4 Strong transcription', 'rgba(0,128,0,1)'],
      ['15 Quiescent / low', 'rgba(255,255,255,1)'],
    ])
  })

  it('drops the blocks of a key row toggled off', () => {
    const display = loaded(CHROMHMM)
    display.toggleCategory(display.colorLegend[0]!.values)
    expect(paintedColors(display)).toHaveLength(2)
  })
})
