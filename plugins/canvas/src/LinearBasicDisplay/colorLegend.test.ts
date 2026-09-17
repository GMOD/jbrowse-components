import { setConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
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

  // Two records, one per biotype, each painting its own color.
  function coloredDisplay(scale: {
    field: string
    domain?: string[]
    palette?: string[]
  }) {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setColorScale(scale)
    display.setRpcData(
      0,
      makeFeatureData({
        flatbushItems: [
          makeFlatbushItem({ featureId: 'pc', groupKey: 'protein_coding' }),
          makeFlatbushItem({ featureId: 'lnc', groupKey: 'lncRNA' }),
          makeFlatbushItem({ featureId: 'sno', groupKey: 'snoRNA' }),
        ],
        colorKey: {
          candidates: [
            {
              rowIndex: 0,
              label: 'protein_coding',
              color: cssColorToABGR('red'),
            },
            { rowIndex: 1, label: 'lncRNA', color: cssColorToABGR('blue') },
            { rowIndex: 2, label: 'snoRNA', color: cssColorToABGR('green') },
          ],
          rows: [
            { strand: undefined, groupKey: 'protein_coding' },
            { strand: undefined, groupKey: 'lncRNA' },
            { strand: undefined, groupKey: 'snoRNA' },
          ],
        },
      }),
      ctgA,
    )
    return display
  }

  const keyValues = (display: ReturnType<typeof coloredDisplay>) =>
    display.legendSpec.sections?.[0]?.items.map(i => i.value)

  it('lists the painted values in the color domain order', () => {
    const display = coloredDisplay({ field: 'biotype', domain: ['lncRNA'] })
    expect(display.colorScales).toEqual([
      expect.objectContaining({
        kind: 'categorical',
        title: 'biotype',
        domain: ['lncRNA'],
      }),
    ])
    expect(keyValues(display)).toEqual(['lncRNA', 'protein_coding', 'snoRNA'])
  })

  it('sorts the values the way sections sort when the color names no domain', () => {
    expect(keyValues(coloredDisplay({ field: 'biotype' }))).toEqual([
      'lncRNA',
      'protein_coding',
      'snoRNA',
    ])
  })

  it('leaves out a value only a hidden section painted', () => {
    const display = coloredDisplay({ field: 'biotype' })
    display.setGroupBy({ type: 'attribute', attribute: 'biotype' })
    display.hideGroup('lncRNA')
    expect(keyValues(display)).toEqual(['protein_coding', 'snoRNA'])
  })

  it('names strand values as strands', () => {
    const display = coloredDisplay({ field: 'strand' })
    display.setRpcData(
      0,
      makeFeatureData({
        colorKey: {
          candidates: [
            { rowIndex: 0, label: '1', color: cssColorToABGR('tomato') },
            {
              rowIndex: 0,
              label: '-1',
              color: cssColorToABGR('cornflowerblue'),
            },
          ],
          rows: [{ strand: undefined, groupKey: undefined }],
        },
      }),
      ctgA,
    )
    expect(display.legendSpec.sections?.[0]?.items.map(i => i.label)).toEqual([
      'Forward strand',
      'Reverse strand',
    ])
  })

  it('yields to a legend slot', () => {
    const display = coloredDisplay({ field: 'biotype' })
    setConf(display, 'legend', [{ label: 'SINE', color: '#e41a1c' }])
    expect(display.colorScales.map(s => s.id)).toEqual(['legend'])
  })

  it('is no key while every value paints one color', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setColorScale({ field: 'biotype' })
    display.setRpcData(
      0,
      makeFeatureData({
        colorKey: {
          candidates: [
            { rowIndex: 0, label: 'a', color: cssColorToABGR('red') },
            { rowIndex: 0, label: 'b', color: cssColorToABGR('red') },
          ],
          rows: [{ strand: undefined, groupKey: undefined }],
        },
      }),
      ctgA,
    )
    expect(display.colorScales).toEqual([])
  })
})
