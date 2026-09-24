import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { LD_FIELD } from '../GWASAdapter/ldFields.ts'
import { LD_DOMAIN, LD_LEGEND_TITLE, LD_PALETTE, ldLegend } from './ldBins.ts'
import { manhattanFixture } from './manhattanFixture.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { ManhattanChannels } from './manhattanLayer.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}

function payload(
  categories?: { value: string; color: string }[],
): ManhattanChannels {
  return manhattanFixture({
    x: [100],
    y: [3],
    flatbush: false,
    scale: categories && {
      kind: 'categorical',
      field: 'name',
      domain: [],
      entries: categories.map(({ value, color }) => ({
        value,
        color: cssColorToABGR(color),
      })),
    },
  })
}

function encodingSent(display: {
  rpcProps: () => { layers: { encoding: object }[] }
}) {
  return display.rpcProps().layers[0]!.encoding
}

function labels(items: MenuItem[]): string[] {
  return items.flatMap(i => [
    'label' in i && typeof i.label === 'string' ? i.label : '',
    ...('subMenu' in i ? labels(resolveSubMenu(i)) : []),
  ])
}

describe('LinearManhattanDisplay field coloring', () => {
  // With no domain the merge falls to `compareGroupKeys`, the order every
  // categorical channel shares, whose digit runs compare by magnitude.
  it('derives the color scale from the payloads, merged across regions and sorted', () => {
    const { display } = createTestEnvironment({
      color: { field: 'name' },
    }).createDisplay()
    expect(display.colorScales).toEqual([])

    display.setRpcData(
      0,
      payload([
        { value: 'chr10', color: '#111111' },
        { value: 'chr2', color: '#222222' },
      ]),
      REGION,
    )
    display.setRpcData(
      1,
      payload([
        { value: 'chr2', color: '#222222' },
        { value: 'chr1', color: '#333333' },
      ]),
      { ...REGION, refName: 'ctgB' },
    )
    expect(display.colorScales).toEqual([
      {
        kind: 'categorical',
        id: 'field',
        title: 'name',
        entries: [
          {
            value: 'chr1',
            values: ['chr1'],
            label: 'chr1',
            color: 'rgba(51,51,51,1)',
          },
          {
            value: 'chr2',
            values: ['chr2'],
            label: 'chr2',
            color: 'rgba(34,34,34,1)',
          },
          {
            value: 'chr10',
            values: ['chr10'],
            label: 'chr10',
            color: 'rgba(17,17,17,1)',
          },
        ],
      },
    ])
  })

  it('a domain keys the values it lists first, and rides to the worker', () => {
    const { display } = createTestEnvironment({
      color: { field: 'name', domain: ['chr10', 'chr2'] },
    }).createDisplay()
    display.setRpcData(
      0,
      payload([
        { value: 'chr1', color: '#333333' },
        { value: 'chr2', color: '#222222' },
        { value: 'chr10', color: '#111111' },
      ]),
      REGION,
    )
    const [scale] = display.colorScales
    expect(
      scale?.kind === 'categorical' ? scale.entries.map(e => e.value) : [],
    ).toEqual(['chr10', 'chr2', 'chr1'])
    expect(encodingSent(display)).toMatchObject({
      color: { domain: ['chr10', 'chr2'] },
    })
  })

  it('has no key under a single color, and the r² bins under LD coloring', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, payload(), REGION)
    expect(display.colorScales).toEqual([])

    const ld = createTestEnvironment({ color: { field: 'ld' } }).createDisplay()
      .display
    const [scale] = ld.colorScales
    expect(scale?.title).toBe(LD_LEGEND_TITLE)
    expect(
      scale?.kind === 'categorical' ? scale.entries.map(e => e.label) : [],
    ).toEqual(ldLegend({}).map(sw => sw.label))
  })

  // Without the note an export where nothing matched the index SNP is an
  // all-grey plot under a full r² key. An index no loaded region holds, as
  // after pinning one and navigating to another contig, is not missing.
  it('a missing index SNP notes why every other point is grey', () => {
    const ld = createTestEnvironment({ color: { field: 'ld' } }).createDisplay()
      .display
    ld.setIndexSnp('ctgA:500')
    const roles = (values: string[]): ManhattanChannels => ({
      ...payload(),
      shapeScale: {
        kind: 'shape',
        field: 'ld_role',
        domain: ['index', 'partner'],
        entries: values.map(value => ({ value, shape: 'circle' as const })),
      },
    })
    ld.setRpcData(1, roles(['']), { ...REGION, refName: 'ctgB' })
    expect(ld.indexSnpMissing).toBe(false)
    ld.setRpcData(0, roles(['index', 'partner', '']), REGION)
    expect(ld.indexSnpMissing).toBe(false)
    ld.setRpcData(0, roles(['index', '']), REGION)
    expect(ld.indexSnpMissing).toBe(true)
    const [scale] = ld.colorScales
    expect(scale?.kind === 'categorical' && scale.note).toBe(
      'No LD data for the index SNP: every other point is grey',
    )
  })

  // The key draws the point the plot draws: the index a diamond, the rest discs
  it('keys each LD row with the shape its points are drawn in', () => {
    const ld = createTestEnvironment({ color: { field: 'ld' } }).createDisplay()
      .display
    const [scale] = ld.colorScales
    const shapes =
      scale?.kind === 'categorical'
        ? scale.entries.map(e => e.swatches?.[0]?.shape)
        : []
    expect(shapes[0]).toBe('diamond')
    expect(new Set(shapes.slice(1))).toEqual(new Set(['circle']))
  })

  // The constant stays in the config for the way back, and the worker is sent
  // only what the categorical scale reads, so it is no fetch input there.
  it('colorByField writes the field through the categorical scale, and it reaches the worker', () => {
    const { display } = createTestEnvironment({
      color: 'rebeccapurple',
    }).createDisplay()
    display.colorByField('population')
    expect(display.color.value).toBe('rebeccapurple')
    expect(encodingSent(display)).toMatchObject({
      color: {
        field: 'population',
        scale: 'categorical',
        domain: undefined,
        range: undefined,
      },
    })
  })

  it('re-picking the field keeps its order; a new field starts from none', () => {
    const { display } = createTestEnvironment({
      color: { field: 'population', domain: ['EUR'] },
    }).createDisplay()
    display.colorByField('population')
    expect(display.color.domain).toEqual(['EUR'])
    display.colorByField('superpopulation')
    expect(display.color.domain).toEqual([])
  })

  it('re-picking a field keeps a threshold the config declares', () => {
    const color = {
      field: 'beta',
      scale: 'threshold',
      domain: ['0'],
      range: ['blue', 'red'],
    }
    const { display } = createTestEnvironment({ color }).createDisplay()
    display.colorByField('beta')
    expect(display.color).toMatchObject(color)
  })

  it('leaving LD coloring restores the constant', () => {
    const { display } = createTestEnvironment({
      color: { value: 'rebeccapurple', field: 'ld' },
    }).createDisplay()
    display.colorByField('')
    expect(display.color).toMatchObject({
      value: 'rebeccapurple',
      scale: 'none',
    })
  })

  it('Single color keeps the field, its order and range for the way back', () => {
    const { display } = createTestEnvironment({
      color: {
        field: 'population',
        domain: ['EUR'],
        range: ['red'],
      },
    }).createDisplay()
    display.colorByField('')
    expect(display.color.scale).toBe('none')
    display.colorByField('population')
    expect(display.color).toMatchObject({
      field: 'population',
      scale: 'categorical',
      domain: ['EUR'],
      range: ['red'],
    })
  })

  it('keys threshold cuts written high to low in the order the points paint them, and the keyless rows a region met', () => {
    const { display } = createTestEnvironment({
      color: { field: 'p', scale: 'threshold', domain: ['0.5', '0.1'] },
    }).createDisplay()
    const rows = () => {
      const [scale] = display.colorScales
      return scale?.kind === 'categorical'
        ? scale.entries.map(e => e.label)
        : []
    }
    expect(rows()).toEqual(['< 0.1', '0.1 – 0.5', '≥ 0.5'])
    display.setRpcData(
      0,
      manhattanFixture({
        x: [100],
        y: [3],
        flatbush: false,
        scale: {
          kind: 'threshold',
          field: 'p',
          domain: [0.1, 0.5],
          missing: true,
        },
      }),
      REGION,
    )
    expect(rows()).toEqual(['< 0.1', '0.1 – 0.5', '≥ 0.5', '(no value)'])
  })

  it("keys { field: 'ld' } with no ldAdapter as the ld field the worker read, grey where it met none", () => {
    const { display } = createTestEnvironment({
      color: { field: 'ld' },
      ldAdapter: false,
    }).createDisplay()
    display.setRpcData(
      0,
      manhattanFixture({
        x: [100],
        y: [3],
        flatbush: false,
        scale: {
          kind: 'threshold',
          field: 'ld',
          domain: [0.2, 0.4, 0.6, 0.8],
          missing: true,
        },
      }),
      REGION,
    )
    const [scale] = display.colorScales
    expect(scale?.title).toBe('ld')
    expect(
      scale?.kind === 'categorical' ? scale.entries.map(e => e.label) : [],
    ).toEqual([
      '< 0.2',
      '0.2 – 0.4',
      '0.4 – 0.6',
      '0.6 – 0.8',
      '≥ 0.8',
      '(no value)',
    ])
  })

  it('LD is the ld field on a threshold scale, whose cuts default to the r² bins', () => {
    const { display } = createTestEnvironment({
      color: { field: 'population', domain: ['EUR'] },
    }).createDisplay()
    display.colorByField(LD_FIELD)
    expect(display.color).toMatchObject({
      field: 'ld',
      scale: 'threshold',
      domain: LD_DOMAIN,
      range: LD_PALETTE,
    })
    expect(display.ldColoringActive).toBe(true)
    display.colorByField('')
    expect(display.color).toMatchObject({ field: 'ld', scale: 'none' })
    expect(display.ldColoringActive).toBe(false)
    display.colorByField('population')
    expect(display.color).toMatchObject({
      field: 'population',
      scale: 'categorical',
    })
  })

  it('a trip through Single color writes no default cut or colour into the config', () => {
    const { display } = createTestEnvironment({
      color: { field: 'ld' },
    }).createDisplay()
    display.colorByField('')
    expect(getSnapshot(display.configuration).color).toEqual({
      field: 'ld',
      scale: 'none',
    })
    display.colorByField(LD_FIELD)
    expect(getSnapshot(display.configuration).color).toEqual({ field: 'ld' })
    expect(display.color).toMatchObject({
      scale: 'threshold',
      domain: LD_DOMAIN,
      range: LD_PALETTE,
    })
  })

  it("a config's bare { field: 'ld' } asks the worker for the five bins and the index diamond", () => {
    const { display } = createTestEnvironment({
      color: { field: 'ld' },
    }).createDisplay()
    expect(encodingSent(display)).toMatchObject({
      color: {
        field: 'ld',
        scale: 'threshold',
        domain: LD_DOMAIN,
        range: LD_PALETTE,
      },
      shape: { field: 'ld_role', domain: ['index', 'partner'] },
    })
  })

  it('refuses a scale the display cannot paint, and an undeclared key', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(() =>
      display.configuration.setSubschema('color', { scale: 'ld' }),
    ).toThrow()
    expect(() =>
      display.configuration.setSubschema('color', { colorBy: 'ld' }),
    ).toThrow('ManhattanColor takes value, field, scale, domain and range')
  })

  it('offers the three schemes as one radio submenu, LD absent without an adapter', () => {
    const { display } = createTestEnvironment({
      ldAdapter: false,
    }).createDisplay()
    const items = display.trackMenuItems()
    expect(labels(items)).toEqual(
      expect.arrayContaining(['Color by...', 'Single color', 'Field...']),
    )
    const colorBy = items.find(i => 'label' in i && i.label === 'Color by...')!
    const ld = ('subMenu' in colorBy ? resolveSubMenu(colorBy) : []).find(
      i => 'label' in i && i.label === 'LD to index SNP',
    )
    expect(ld).toBeUndefined()

    display.colorByField('population')
    expect(labels(display.trackMenuItems())).toContain('Field (population)...')
  })

  it('the Single color and LD radios keep the field for the way back', () => {
    const { display } = createTestEnvironment({
      color: { field: 'population', domain: ['EUR'] },
    }).createDisplay()
    const click = (label: string) => {
      const colorBy = display
        .trackMenuItems()
        .find(i => 'label' in i && i.label === 'Color by...')!
      const item = ('subMenu' in colorBy ? resolveSubMenu(colorBy) : []).find(
        i => 'label' in i && i.label === label,
      )
      if (item && 'onClick' in item) {
        item.onClick()
      }
    }
    click('Single color')
    expect(getSnapshot(display.configuration).color).toEqual({
      field: 'population',
      scale: 'none',
      domain: ['EUR'],
    })
    click('LD to index SNP')
    expect(display.ldColoringActive).toBe(true)
    expect(getSnapshot(display.configuration).color).toEqual({ field: 'ld' })
  })
})

test('LD bins that do not fit their colours are a notice', () => {
  const { display } = createTestEnvironment({
    color: { field: 'ld', domain: [0.2, 0.8], range: ['red', 'blue'] },
  }).createDisplay()
  expect(display.notices).toEqual([
    expect.stringMatching(/^color\.range: 2 threshold cuts make 3 intervals/),
  ])
})
