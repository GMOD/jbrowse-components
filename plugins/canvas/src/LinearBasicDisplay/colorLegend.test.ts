import { setConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
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
              value: 'protein_coding',
              color: cssColorToABGR('red'),
            },
            { rowIndex: 1, value: 'lncRNA', color: cssColorToABGR('blue') },
            { rowIndex: 2, value: 'snoRNA', color: cssColorToABGR('green') },
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

  // What the worker's walk records: a colour per key, `''` for no value.
  function paintedData(keys: string[]) {
    return makeFeatureData({
      colorKey: {
        candidates: keys.map((value, i) => ({
          rowIndex: 0,
          value,
          color: cssColorToABGR(
            value === '' ? NO_CATEGORY_COLOR : `hsl(${i * 40}, 70%, 50%)`,
          ),
        })),
        rows: [{ strand: undefined, groupKey: undefined }],
      },
    })
  }

  const keyValues = (display: ReturnType<typeof coloredDisplay>) =>
    display.legendSpec.sections?.[0]?.items.map(i => i.value)

  it('keeps the no-value row last under a declared domain', () => {
    const display = coloredDisplay({ field: 'biotype', domain: ['snoRNA'] })
    display.setRpcData(0, paintedData(['', 'protein_coding', 'snoRNA']), ctgA)
    expect(keyValues(display)).toEqual(['snoRNA', 'protein_coding', ''])
  })

  it('keeps the no-value row last with no domain', () => {
    const display = coloredDisplay({ field: 'biotype' })
    display.setRpcData(0, paintedData(['', 'protein_coding', 'lncRNA']), ctgA)
    expect(keyValues(display)).toEqual(['lncRNA', 'protein_coding', ''])
  })

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

  it("lists the key in the sections' order where the facet reads the same field", () => {
    const display = coloredDisplay({ field: 'biotype', domain: ['lncRNA'] })
    display.setFacet({ field: 'biotype', domain: ['snoRNA', 'protein_coding'] })
    expect(keyValues(display)).toEqual(['snoRNA', 'protein_coding', 'lncRNA'])
    display.setFacet({ field: 'source', domain: ['snoRNA'] })
    expect(keyValues(display)).toEqual(['lncRNA', 'protein_coding', 'snoRNA'])
  })

  it('leaves out a value only a hidden section painted', () => {
    const display = coloredDisplay({ field: 'biotype' })
    display.setFacet({ field: 'biotype' })
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
            { rowIndex: 0, value: '1', color: cssColorToABGR('tomato') },
            {
              rowIndex: 0,
              value: '-1',
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

  describe('Pin distinct colors', () => {
    const colorByRows = (display: ReturnType<typeof coloredDisplay>) => {
      const item = display
        .trackMenuItems()
        .find(i => 'label' in i && i.label === 'Color by...')!
      return resolveSubMenu(item as Parameters<typeof resolveSubMenu>[0])
    }
    const pinRow = (display: ReturnType<typeof coloredDisplay>) =>
      colorByRows(display).find(
        i => 'label' in i && i.label === 'Pin distinct colors',
      ) as { disabled?: boolean; onClick: () => void } | undefined

    function paint(
      display: ReturnType<typeof coloredDisplay>,
      labels: string[],
    ) {
      display.setRpcData(0, paintedData(labels), ctgA)
    }

    it('is offered only while a field paints', () => {
      const { createDisplay } = createTestEnvironment()
      const { display } = createDisplay()
      expect(pinRow(display)).toBeUndefined()
      display.setFeatureColor('red')
      expect(pinRow(display)).toBeUndefined()
      expect(pinRow(coloredDisplay({ field: 'biotype' }))).toBeDefined()
    })

    it('writes the key in its order after the domain, less the no-value row', () => {
      const display = coloredDisplay({ field: 'biotype', domain: ['snoRNA'] })
      paint(display, ['protein_coding', '', 'snoRNA', 'lncRNA'])
      pinRow(display)!.onClick()
      expect(display.colorSettings.colorDomain).toEqual([
        'snoRNA',
        'lncRNA',
        'protein_coding',
      ])
      expect(pinRow(display)!.disabled).toBe(true)
    })

    it('keeps the earlier order when a second pin adds the values that arrived since', () => {
      const display = coloredDisplay({ field: 'biotype' })
      paint(display, ['protein_coding', 'lncRNA'])
      pinRow(display)!.onClick()
      paint(display, ['protein_coding', 'antisense', 'miRNA'])
      expect(pinRow(display)!.disabled).toBe(false)
      pinRow(display)!.onClick()
      expect(display.colorSettings.colorDomain).toEqual([
        'lncRNA',
        'protein_coding',
        'antisense',
        'miRNA',
      ])
    })
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
            { rowIndex: 0, value: 'a', color: cssColorToABGR('red') },
            { rowIndex: 0, value: 'b', color: cssColorToABGR('red') },
          ],
          rows: [{ strand: undefined, groupKey: undefined }],
        },
      }),
      ctgA,
    )
    expect(display.colorScales).toEqual([])
  })
})
