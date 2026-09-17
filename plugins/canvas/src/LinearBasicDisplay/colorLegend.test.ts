import { setConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { attributeColorJexl } from '../RenderFeatureDataRPC/featureColors.ts'
import { makeFeatureData } from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

describe('declared color legend', () => {
  it('is no scale until the legend slot carries entries', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(display.colorScales).toEqual([])
    expect(display.legendSpec.sections).toEqual([])

    setConf(display, 'legend', [
      { label: 'SINE', color: '#e41a1c' },
      { label: 'LINE', color: '#377eb8' },
    ])
    expect(display.colorScales).toEqual([
      {
        kind: 'categorical',
        id: 'legend',
        entries: [
          { value: 'SINE', label: 'SINE', color: '#e41a1c' },
          { value: 'LINE', label: 'LINE', color: '#377eb8' },
        ],
      },
    ])
    expect(display.legendSpec.sections![0]!.items).toEqual([
      { value: 'SINE', label: 'SINE', color: '#e41a1c' },
      { value: 'LINE', label: 'LINE', color: '#377eb8' },
    ])
  })

  it('offers the showLegend toggle only where there is a key', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    const showItems = () => {
      const show = display
        .trackMenuItems()
        .find((i: MenuItem) => 'label' in i && i.label === 'Show...')
      return show && 'subMenu' in show ? resolveSubMenu(show) : []
    }
    const legendItem = () =>
      showItems().find(
        (i: MenuItem) => 'label' in i && i.label === 'Show legend',
      )

    expect(legendItem()).toBeUndefined()

    setConf(display, 'legend', [{ label: 'SINE', color: '#e41a1c' }])
    expect(display.showLegend).toBe(true)
    expect(legendItem()).toMatchObject({ type: 'checkbox', checked: true })

    display.setShowLegend(false)
    const hidden = legendItem()!
    expect(hidden).toMatchObject({ type: 'checkbox', checked: false })

    if ('onClick' in hidden) {
      hidden.onClick()
    }
    expect(display.showLegend).toBe(true)
  })
})

describe('derived color key', () => {
  const ctgA = {
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 10_000,
  }

  function coloredDisplay() {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    setConf(display, 'color', attributeColorJexl('biotype', ['lncRNA']))
    display.setRpcData(
      0,
      makeFeatureData({
        legendCandidates: [
          {
            rowIndex: 0,
            label: 'protein_coding',
            color: cssColorToABGR('red'),
          },
          { rowIndex: 0, label: 'lncRNA', color: cssColorToABGR('blue') },
        ],
      }),
      ctgA,
    )
    return display
  }

  it('lists the painted values in the color domain order', () => {
    const display = coloredDisplay()
    expect(display.colorScales).toEqual([
      expect.objectContaining({
        kind: 'categorical',
        title: 'biotype',
        domain: ['lncRNA'],
        entries: [
          expect.objectContaining({ value: 'protein_coding' }),
          expect.objectContaining({ value: 'lncRNA' }),
        ],
      }),
    ])
    expect(display.legendSpec.sections![0]!.items.map(i => i.value)).toEqual([
      'lncRNA',
      'protein_coding',
    ])
  })

  it('yields to a legend slot', () => {
    const display = coloredDisplay()
    setConf(display, 'legend', [{ label: 'SINE', color: '#e41a1c' }])
    expect(display.colorScales.map(s => s.id)).toEqual(['legend'])
  })

  it('is no key while every value paints one color', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    setConf(display, 'color', attributeColorJexl('biotype'))
    display.setRpcData(
      0,
      makeFeatureData({
        legendCandidates: [
          { rowIndex: 0, label: 'a', color: cssColorToABGR('red') },
          { rowIndex: 0, label: 'b', color: cssColorToABGR('red') },
        ],
      }),
      ctgA,
    )
    expect(display.colorScales).toEqual([])
  })
})
