import { setConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import {
  MISCONFIGURED_COLOR,
  NO_CATEGORY_COLOR,
} from '@jbrowse/core/util/color'
import { abgrToCssRgba, cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { autorun } from 'mobx'

import {
  makeFeatureData,
  makeFlatbushItem,
  packFixtureRects,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

describe('the color key', () => {
  it('is no scale while no field paints', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(display.colorScales).toEqual([])
    expect(display.legendSpec.sections).toEqual([])
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

    display.setColorScale({ field: 'repClass' })
    display.setRpcData(
      0,
      makeFeatureData({
        colorValues: {
          field: 'repClass',
          values: ['SINE', 'LINE'],
          painted: [
            { rowIndex: 0, valueIndex: 0 },
            { rowIndex: 0, valueIndex: 1 },
          ],
          rows: [{ strand: undefined, groupKey: undefined }],
        },
      }),
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 },
    )
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

  it("names an identity scale's colours once anything is drawn", () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    setConf(display, 'color', {
      scale: 'identity',
      domain: ['rgb(255,0,0)', 'rgb(0,0,255)'],
      labels: ['Active', 'Repressed'],
      title: 'State',
    })
    expect(display.colorScales).toEqual([])
    expect(display.colorEncoding).toBeUndefined()

    display.setRpcData(
      0,
      makeFeatureData(packFixtureRects([{ startBp: 0, endBp: 100 }])),
      {
        assemblyName: 'volvox',
        refName: 'ctgA',
        start: 0,
        end: 10_000,
      },
    )
    expect(display.colorScales[0]?.title).toBe('State')
    const [section] = display.legendSpec.sections
    expect(section?.items.map(i => i.label)).toEqual(['Active', 'Repressed'])
    expect(display.plot.color).toMatchObject({ scale: 'identity' })
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
    field = 'biotype',
  ) {
    return makeFeatureData({
      colorValues: {
        field,
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
          scale.field,
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
    display.setRpcData(0, paintedData(['1', '-1'], noSection, 'strand'), ctgA)
    expect(display.legendSpec.sections[0]?.items.map(i => i.label)).toEqual([
      'Forward strand',
      'Reverse strand',
    ])
  })

  describe('colours dealt on first sight', () => {
    const colorsOf = (display: ReturnType<typeof coloredDisplay>) =>
      new Map(
        display.legendSpec.sections[0]?.items.map(i => [i.label, i.color]),
      )

    it('paints three values the hash puts on one colour three colours', () => {
      const display = coloredDisplay({ field: 'biotype' })
      display.setRpcData(
        0,
        paintedData(['protein_coding', 'snRNA', 'TEC']),
        ctgA,
      )
      expect(new Set(colorsOf(display).values()).size).toBe(3)
    })

    it('keeps every colour shown as another region brings new values', () => {
      const display = coloredDisplay({ field: 'biotype' })
      display.setRpcData(0, paintedData(['protein_coding', 'lncRNA']), ctgA)
      const before = colorsOf(display)
      display.setRpcData(1, paintedData(['snRNA', 'TEC', 'lncRNA']), {
        ...ctgA,
        refName: 'ctgB',
      })
      const after = colorsOf(display)
      expect(after.get('protein_coding')).toBe(before.get('protein_coding'))
      expect(after.get('lncRNA')).toBe(before.get('lncRNA'))
      expect(new Set(after.values()).size).toBe(after.size)
    })

    it('spills a range too short for the values into the wide palette', () => {
      const display = coloredDisplay({
        field: 'biotype',
        range: ['red', 'blue'],
      })
      display.setRpcData(
        0,
        paintedData(['protein_coding', 'lncRNA', 'snoRNA']),
        ctgA,
      )
      const items = display.legendSpec.sections[0]?.items ?? []
      expect(items).toHaveLength(3)
      expect(items.some(i => i.label.includes(', '))).toBe(false)
    })

    it('offers no pin', () => {
      const item = coloredDisplay({ field: 'biotype' })
        .trackMenuItems()
        .find(i => 'label' in i && i.label === 'Color by...')!
      expect(
        resolveSubMenu(item as Parameters<typeof resolveSubMenu>[0]).map(
          i => 'label' in i && i.label,
        ),
      ).not.toContain('Pin distinct colors')
    })
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
      display.setRpcData(0, paintedData(['0.45', ''], noSection, 'dif'), ctgA)
      expect(display.colorScales[0]).toMatchObject({ title: 'dif' })
      expect(keyValues(display)).toEqual(['< -0.3', '-0.3 – 0.3', '≥ 0.3', ''])
      expect(display.colorByMode).toBe('attribute')
      expect(display.colorField).toBeUndefined()
    })

    it('names each interval by its label, keyed by the interval still', () => {
      const display = thresholdDisplay()
      setConf(display, ['color', 'labels'], ['Loss', 'Neutral', 'Gain'])
      display.setRpcData(0, paintedData(['0.45'], noSection, 'dif'), ctgA)
      const items = display.legendSpec.sections[0]?.items ?? []
      expect(items.map(i => i.label)).toEqual(['Loss', 'Neutral', 'Gain'])
      expect(items.map(i => i.value)).toEqual(['< -0.3', '-0.3 – 0.3', '≥ 0.3'])
      expect(display.notices).toEqual([])
      setConf(display, ['color', 'labels'], ['a', 'b', 'c', 'd'])
      expect(display.notices).toEqual([
        expect.stringMatching(/4 labels name 3 intervals/),
      ])
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

  it('names a listed value by its label, and heads the key with the title', () => {
    const display = coloredDisplay({
      field: 'biotype',
      domain: ['lncRNA', 'protein_coding'],
    })
    setConf(display, ['color', 'labels'], ['Long non-coding', 'Coding'])
    setConf(display, ['color', 'title'], 'Biotype')
    expect(display.colorScales[0]).toMatchObject({ title: 'Biotype' })
    expect(display.legendSpec.sections[0]?.items.map(i => i.label)).toEqual([
      'Long non-coding',
      'Coding',
      'snoRNA',
    ])
    setConf(display, ['color', 'title'], '')
    expect(display.colorScales[0]?.title ?? '').toBe('')
  })

  // A settings change keeps the held regions drawn until the refetch lands,
  // and theirs are the old field's values.
  it("keys nothing from a region the new field's values have not reached", () => {
    const display = coloredDisplay({ field: 'biotype' })
    display.colorByField('strand')
    expect(display.colorScales).toEqual([])
  })

  it('notices labels past the domain, which name nothing', () => {
    const display = coloredDisplay({ field: 'biotype' })
    setConf(display, ['color', 'labels'], ['Coding', 'Long'])
    expect(display.notices).toEqual([
      expect.stringMatching(/^color\.labels: .*2 labels name 0 values/),
    ])
  })

  it("pairs strand's labels with strand's own order, as its range does", () => {
    const display = coloredDisplay({ field: 'strand' })
    setConf(display, ['color', 'labels'], ['Plus', 'Minus'])
    display.setRpcData(0, paintedData(['1', '-1'], noSection, 'strand'), ctgA)
    expect(display.notices).toEqual([])
    expect(display.legendSpec.sections[0]?.items.map(i => i.label)).toEqual([
      'Plus',
      'Minus',
    ])
  })

  describe('ramp color', () => {
    function rampDisplay(color: Record<string, unknown> = { field: 'score' }) {
      const { createDisplay } = createTestEnvironment()
      const { display } = createDisplay()
      setConf(display, 'color', color)
      display.setRpcData(
        0,
        paintedData(['0', '50', '100', ''], noSection, 'score'),
        ctgA,
      )
      return display
    }

    it('is what score paints through while scale is unset', () => {
      const display = rampDisplay()
      expect(display.colorEncoding).toMatchObject({
        field: 'score',
        scale: 'linear',
      })
      expect(display.colorByMode).toBe('attribute')
      expect(display.colorField).toBeUndefined()
    })

    it('paints the loaded extent end to end, and a feature with no score grey', () => {
      const paint = rampDisplay({
        field: 'score',
        range: ['#000000', '#ffffff'],
      }).paintColorValue!
      expect(paint('0')).toBe('rgba(0,0,0,1)')
      expect(paint('100')).toBe('rgba(255,255,255,1)')
      expect(paint('')).toBe(NO_CATEGORY_COLOR)
      expect(paint('n/a')).toBe(
        abgrToCssRgba(cssColorToABGR(MISCONFIGURED_COLOR)),
      )
    })

    it('keys the ramp over the loaded extent, or the ends a config pins', () => {
      expect(rampDisplay().colorScales).toEqual([
        expect.objectContaining({
          kind: 'ramp',
          title: 'score',
          domain: [0, 100],
        }),
        expect.objectContaining({
          kind: 'categorical',
          id: 'color-gaps',
          entries: [expect.objectContaining({ value: '', missing: true })],
        }),
      ])
      expect(
        rampDisplay({ field: 'score', domainMin: -50 }).colorScales[0],
      ).toMatchObject({ domain: [-50, 100] })
    })

    // The bar is drawn from these two, and both displays composing
    // `featureColorViews` read them off the one derivation: `extent` is what
    // the ramp actually painted over, against the `domain` above, which a
    // pinned end moves.
    it('draws its bar from the loaded extent at a readable number of stops', () => {
      const [ramp] = rampDisplay({ field: 'score', domainMin: -50 }).colorScales
      expect(ramp).toMatchObject({ kind: 'ramp', extent: [0, 100] })
      expect(ramp?.kind === 'ramp' && ramp.stops).toHaveLength(8)
    })

    it('under a domain quantile weighs each painted box, so a lone spike stops short', () => {
      const { createDisplay } = createTestEnvironment()
      const { display } = createDisplay()
      setConf(display, 'color', {
        field: 'score',
        domainQuantile: 0.9,
      })
      const values = ['1', '2', '10000']
      display.setRpcData(
        0,
        {
          ...paintedData(values, noSection, 'score'),
          rectColorValues: Uint32Array.from([
            ...Array.from({ length: 50 }, () => 1),
            ...Array.from({ length: 49 }, () => 2),
            3,
          ]),
        },
        ctgA,
      )
      expect(display.colorScales[0]).toMatchObject({
        kind: 'ramp',
        domain: [1, 2],
      })
    })

    // The id is the legend's dismissal key and its React key prefix, and the
    // two displays composing the derivation ask for different ones — so it is
    // the caller's word, never the derivation's.
    it('carries the scale id its display asked for', () => {
      expect(rampDisplay().colorScales.map(scale => scale.id)).toEqual([
        'color',
        'color-gaps',
      ])
    })

    it('hands the encode one palette while a commit leaves the ramp alone', () => {
      const display = rampDisplay({
        field: 'score',
        domainMin: 0,
        domainMax: 1,
      })
      const held = autorun(() => {
        void display.fieldPalette
      })
      const palette = display.fieldPalette
      display.setRpcData(1, paintedData(['7'], noSection, 'score'), ctgA)
      expect(display.fieldPalette).toBe(palette)

      setConf(display, 'color', { field: 'score' })
      const open = display.fieldPalette
      display.setRpcData(1, paintedData(['40'], noSection, 'score'), ctgA)
      expect(display.fieldPalette).toBe(open)
      display.setRpcData(1, paintedData(['400'], noSection, 'score'), ctgA)
      expect(display.fieldPalette).not.toBe(open)
      held()
    })

    it('paints blank text the misconfiguration grey, not the low end', () => {
      const paint = rampDisplay().paintColorValue!
      expect(paint(' ')).toBe(
        abgrToCssRgba(cssColorToABGR(MISCONFIGURED_COLOR)),
      )
    })

    it('takes a scheme and a log scale on any numeric field', () => {
      const display = rampDisplay({
        field: 'score',
        scale: 'log',
        scheme: 'magma',
      })
      expect(display.colorScales[0]).toMatchObject({ kind: 'ramp' })
      expect(display.notices).toEqual([])
    })
  })
})
