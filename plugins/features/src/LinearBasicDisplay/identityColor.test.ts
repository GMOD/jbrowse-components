import { setConf } from '@jbrowse/core/configuration'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import { SimpleFeature } from '@jbrowse/core/util'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { boxColor } from '../RenderFeatureDataRPC/collect/glyphColors.ts'
import { mockDisplayConfig } from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { TestDisplay } from './testEnv.ts'

const jexl = createJexlInstance()

const tinted = new SimpleFeature({
  uniqueId: 'f1',
  refName: 'ctgA',
  start: 0,
  end: 10,
  type: 'gene',
  color: '#d73027',
  itemRgb: '0,0,255',
})

// What the worker paints a feature, off the settings the display sends it.
function painted(display: TestDisplay) {
  const config = mockDisplayConfig({
    color: display.rpcProps().displayConfig.color,
  })
  return boxColor(tinted, { config, colorByFrame: false, jexl }).color
}

function identityDisplay(color: Record<string, unknown>, parkedField?: string) {
  const { display } = createTestEnvironment().createDisplay(
    parkedField === undefined
      ? {}
      : { parkedColors: { color: { field: parkedField } } },
  )
  setConf(display, ['encoding', 'color'], {
    ...color,
    scale: { type: 'identity' },
  })
  return display
}

describe('an identity scale on the feature display', () => {
  it('paints the CSS color its written field holds', () => {
    expect(painted(identityDisplay({ field: 'color' }))).toBe('#d73027')
  })

  it('never paints the parked field, whose values ship for the way back', () => {
    const display = identityDisplay({}, 'color')
    expect(display.rpcProps().displayConfig.color.field).toBe('color')
    expect(painted(display)).toBe('0,0,255')
  })

  it('refetches when the field it paints changes', () => {
    const display = identityDisplay({ field: 'color' })
    const before = display.rpcProps()
    setConf(display, ['encoding', 'color', 'field'], 'colour')
    expect(display.rpcProps()).not.toEqual(before)
    expect(painted(display)).toBe(featureDefaultColor)
  })

  it('refetches when a parked field starts to paint', () => {
    const display = identityDisplay({}, 'color')
    const before = display.rpcProps()
    setConf(display, ['encoding', 'color', 'field'], 'color')
    expect(display.rpcProps()).not.toEqual(before)
    expect(painted(display)).toBe('#d73027')
  })

  it('ticks Color by Attribute... while its field paints, as multi-row does', () => {
    expect(identityDisplay({ field: 'color' }).colorByMode).toBe('attribute')
    expect(identityDisplay({}).colorByMode).toBe('default')
    expect(
      identityDisplay({ field: 'color', value: 'green' }).colorByMode,
    ).toBe('solid')
  })
})
