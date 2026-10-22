import { resolveSubMenu } from '@jbrowse/core/ui'
import { SCALE_TYPE_LOG } from '@jbrowse/render-core/scoreScale'

import { INSTANCE_STRIDE_WORDS } from './components/shaders/hic.iface.generated.ts'
import { expectedOf } from './contactLookup.ts'
import { createTestEnvironment } from './testEnv.ts'
import { buildHicTrackMenuItems } from './trackMenuItems.ts'

import type { HicDataResult } from '../RenderHicDataRPC/types.ts'
import type { HicColorField } from './hicColorConfigSchema.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const { createDisplay } = createTestEnvironment()

function payload(appliedField: HicColorField): HicDataResult {
  return {
    instances: new Float32Array(INSTANCE_STRIDE_WORDS),
    numContacts: 1,
    maxScore: 6,
    quantileScore: 3,
    quantile: 0.95,
    binWidth: 4,
    originBp: 0,
    resolution: 1000,
    appliedNormalization: 'KR',
    appliedField,
    regions: [
      {
        refName: 'ctgA',
        dataXStart: 0,
        dataXEnd: 256,
        combinedOffset: 0,
        reversed: false,
      },
    ],
    pairRuns: [
      {
        region1Idx: 0,
        region2Idx: 0,
        start: 0,
        end: 1,
        expected: {
          kind: 'intra',
          firstDistance: 2,
          values: Float64Array.of(10, 5, 2.5),
        },
      },
    ],
  }
}

function labelOf(item: MenuItem) {
  return 'label' in item ? item.label : undefined
}

function subMenu(items: MenuItem[], label: string) {
  const item = items.find(i => labelOf(i) === label)
  return item && 'subMenu' in item ? resolveSubMenu(item) : []
}

test('observed/expected paints a log ramp diverging at 1, red where enriched', () => {
  const { display } = createDisplay()
  display.setColorField('observed/expected')
  expect(display.plot).toEqual({ color: 'observed/expected' })
  expect(display.rpcProps().field).toBe('observed/expected')
  expect(display.colorEncoding).toMatchObject({
    scale: 'log',
    scheme: 'redblue',
    reverse: true,
    domainMid: 1,
  })
  expect(display.colorDomain).toEqual([0.25, 4])
  expect(display.renderState).toMatchObject({
    scaleType: SCALE_TYPE_LOG,
    domainMin: 0.25,
    domainMax: 4,
    midNorm: 0.5,
  })
})

test('a new field starts from its own preset', () => {
  const { display } = createDisplay()
  display.setColorScheme('viridis')
  display.setColorField('observed/expected')
  expect(display.colorScheme).toBe('redblue')
  display.setColorField('observed')
  expect(display.colorScheme).toBe('juicebox')
})

test('the key and menu follow the field the file could serve', () => {
  const { display } = createDisplay()
  display.setColorField('observed/expected')
  display.setRpcData(payload('observed'))
  expect(display.paintedColorField).toBe('observed')
  expect(display.colorScheme).toBe('juicebox')
  expect(display.colorScales[0]?.title).toBe('Contacts (KR) · 1Kbp')

  const values = subMenu(buildHicTrackMenuItems(display), 'Values')
  const asked = values.find(i => labelOf(i) === 'Observed/expected')
  expect(asked && 'helpText' in asked ? asked.helpText : '').toMatch(
    /no expected values/,
  )
  expect(values.filter(i => 'checked' in i && i.checked).map(labelOf)).toEqual([
    'Observed',
  ])
})

test('a ratio offers no count scale toggles, and names itself in the key', () => {
  const { display } = createDisplay()
  display.setColorField('observed/expected')
  display.setRpcData(payload('observed/expected'))
  expect(display.colorScales[0]?.title).toBe('Observed/expected (KR) · 1Kbp')
  expect(display.valueLabel).toBe('Observed/expected (KR)')
  const scheme = subMenu(buildHicTrackMenuItems(display), 'Color scheme')
  expect(scheme.map(labelOf)).not.toContain('Log scale')
})

test('hover reads a ratio expected count off its pair run', () => {
  const data = payload('observed/expected')
  const item = { bin1: 4, bin2: 7, region1Idx: 0, region2Idx: 0, value: 2 }
  // distance 3 is the vector's second entry, its first being distance 2
  expect(expectedOf(data, item)).toBe(5)
  expect(
    expectedOf(payload('observed'), { ...item, region2Idx: 1 }),
  ).toBeUndefined()
})
