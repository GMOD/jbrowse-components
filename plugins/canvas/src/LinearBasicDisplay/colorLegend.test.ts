import { setConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

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
    expect(display.legendSpec.sections[0]!.items).toEqual([
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

  const noSection = [{ strand: undefined, groupKey: undefined }]

  // What the worker's walk ships: the field's values, each a box carried, in
  // the section its record files under.
  function paintedData(
    values: string[],
    rows: { strand: undefined; groupKey: string | undefined }[] = noSection,
  ) {
    return makeFeatureData({
      colorValues: {
        values,
        painted: values.map((_, i) => ({
          rowIndex: rows.length > 1 ? i : 0,
          valueIndex: i,
        })),
        rows,
      },
    })
  }

  // Three records, one per biotype, each in its own section.
  function coloredDisplay(scale: {
    field: string
    domain?: string[]
    range?: string[]
  }) {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setColorScale(scale)
    const biotypes = ['protein_coding', 'lncRNA', 'snoRNA']
    display.setRpcData(
      0,
      {
        ...paintedData(
          biotypes,
          biotypes.map(groupKey => ({ strand: undefined, groupKey })),
        ),
        flatbushItems: [
          makeFlatbushItem({ featureId: 'pc', groupKey: 'protein_coding' }),
          makeFlatbushItem({ featureId: 'lnc', groupKey: 'lncRNA' }),
          makeFlatbushItem({ featureId: 'sno', groupKey: 'snoRNA' }),
        ],
      },
      ctgA,
    )
    return display
  }

  const keyValues = (display: ReturnType<typeof coloredDisplay>) =>
    display.legendSpec.sections[0]?.items.map(i => i.value)

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
    display.setRpcData(0, paintedData(['1', '-1']), ctgA)
    expect(display.legendSpec.sections[0]?.items.map(i => i.label)).toEqual([
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
      expect(display.colorSettings.domain).toEqual([
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
      expect(display.colorSettings.domain).toEqual([
        'lncRNA',
        'protein_coding',
        'antisense',
        'miRNA',
      ])
    })

    it('pins every value of a row two values share, so the pin tells them apart', () => {
      // Two colors for three values: two of them share one.
      const display = coloredDisplay({
        field: 'biotype',
        range: ['red', 'blue'],
      })
      display.setRpcData(
        0,
        paintedData(['protein_coding', 'lncRNA', 'snoRNA']),
        ctgA,
      )
      expect(display.legendSpec.sections[0]?.items).toHaveLength(2)
      pinRow(display)!.onClick()
      expect(display.colorSettings.domain.toSorted()).toEqual([
        'lncRNA',
        'protein_coding',
        'snoRNA',
      ])
      expect(display.legendSpec.sections[0]?.items).toHaveLength(3)
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
    display.setColorScale({
      field: 'biotype',
      domain: ['a', 'b'],
      range: ['red', 'red'],
    })
    display.setRpcData(0, paintedData(['a', 'b']), ctgA)
    expect(display.colorScales).toEqual([])
  })

  describe('threshold color', () => {
    function thresholdDisplay(range = ['#0000ff', '#8888ff', '#ff0000']) {
      const { createDisplay } = createTestEnvironment()
      const { display } = createDisplay()
      setConf(display, 'color', {
        field: 'dif',
        scale: 'threshold',
        domain: ['-0.3', '0.3'],
        range,
      })
      return display
    }

    it('keys every bin in order, and the no-value row once something paints it', () => {
      const display = thresholdDisplay()
      display.setRpcData(0, paintedData(['0.45', '']), ctgA)
      expect(display.colorScales[0]).toMatchObject({ title: 'dif' })
      expect(keyValues(display)).toEqual(['< -0.3', '-0.3 – 0.3', '≥ 0.3', ''])
      expect(display.colorByMode).toBe('attribute')
      expect(display.colorField).toBeUndefined()
    })

    it('offers no pin, which would write values into the cuts', () => {
      const item = thresholdDisplay()
        .trackMenuItems()
        .find(i => 'label' in i && i.label === 'Color by...')!
      expect(
        resolveSubMenu(item as Parameters<typeof resolveSubMenu>[0]).map(
          i => 'label' in i && i.label,
        ),
      ).not.toContain('Pin distinct colors')
    })

    it('notices a range that is not one colour per interval', () => {
      expect(thresholdDisplay().notices).toEqual([])
      expect(thresholdDisplay(['#0000ff', '#ff0000']).notices).toEqual([
        expect.stringMatching(
          /^color\.range: 2 threshold cuts make 3 intervals/,
        ),
      ])
    })
  })
})
