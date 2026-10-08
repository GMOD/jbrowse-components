import { setConf } from '@jbrowse/core/configuration'
import { rampLutOf, stopsFromRampLut } from '@jbrowse/core/util/colorRamp'

import { INSTANCE_STRIDE_WORDS } from './components/shaders/hic.iface.generated.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { HicDataResult } from '../RenderHicDataRPC/types.ts'

const DATA: HicDataResult = {
  instances: new Float32Array(INSTANCE_STRIDE_WORDS),
  numContacts: 1,
  maxScore: 400,
  quantileScore: 40,
  binWidth: 4,
  originBp: 0,
  resolution: 1000,
  appliedNormalization: 'KR',
  regions: [
    {
      refName: 'ctgA',
      dataXStart: 0,
      dataXEnd: 256,
      combinedOffset: 0,
      reversed: false,
    },
  ],
  pairRuns: [{ region1Idx: 0, region2Idx: 0, start: 0, end: 1 }],
}

const { createDisplay } = createTestEnvironment()

function loaded() {
  const { display } = createDisplay()
  display.setRpcData(DATA)
  return display
}

test('the key is one ramp over the color domain, its two ends labelled', () => {
  const display = loaded()
  expect(display.legendSpec.sections).toEqual([
    {
      id: 'contacts',
      title: 'Contacts (KR)',
      items: [
        {
          label: 'Contacts (KR)',
          gradient: {
            stops: stopsFromRampLut(rampLutOf({ scheme: 'juicebox' }), 11),
            minLabel: '0',
            maxLabel: '≥40',
          },
        },
      ],
    },
  ])
})

test('the key follows the encoding: log floor, pinned top and scheme', () => {
  const display = loaded()
  setConf(display, ['color', 'scale'], 'log')
  setConf(display, ['color', 'domainMax'], 1000)
  setConf(display, ['color', 'scheme'], 'viridis')
  const [item] = display.legendSpec.sections[0]!.items
  expect(item).toEqual({
    label: 'Contacts (KR, log)',
    gradient: {
      stops: stopsFromRampLut(
        rampLutOf({ scheme: 'viridis', reverse: true }),
        11,
      ),
      minLabel: '1',
      maxLabel: '1000',
    },
  })
})
