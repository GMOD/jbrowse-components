import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { LD_LEGEND, LD_LEGEND_TITLE } from './ldBins.ts'
import { manhattanFixture } from './manhattanFixture.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}

function payload(
  categories?: { value: string; color: string }[],
): ManhattanRpcResult {
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
    expect(display.rpcProps().color.domain).toEqual(['chr10', 'chr2'])
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
    ).toEqual(LD_LEGEND.map(s => s.label))
  })

  // Without it an export where nothing matched the index SNP is an all-grey
  // plot under a full r² key that implies the colors mean something.
  it('a missing index SNP adds a note row saying why every point is grey', () => {
    const ld = createTestEnvironment({ color: { field: 'ld' } }).createDisplay()
      .display
    ld.setIndexSnp('ctgA:500')
    ld.setRpcData(0, { ...payload(), indexFound: false }, REGION)
    expect(ld.indexSnpMissing).toBe(true)
    const [scale] = ld.colorScales
    const last =
      scale?.kind === 'categorical' ? scale.entries.at(-1) : undefined
    expect(last).toEqual({
      value: 'missing',
      label: 'Index SNP not in LD data: all grey',
    })
  })

  it('colorByField writes the field through the categorical scale, and it reaches the worker', () => {
    const { display } = createTestEnvironment({
      color: 'rebeccapurple',
    }).createDisplay()
    display.colorByField('population')
    expect(display.rpcProps()).toMatchObject({
      color: {
        value: 'rebeccapurple',
        field: 'population',
        scale: 'categorical',
      },
      scoreField: 'score',
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

  it('leaving LD coloring restores the constant', () => {
    const { display } = createTestEnvironment({
      color: { value: 'rebeccapurple', field: 'ld' },
    }).createDisplay()
    display.setColorScale('none')
    expect(display.color).toMatchObject({
      value: 'rebeccapurple',
      scale: 'none',
    })
  })

  it('Single color keeps the field, its order and palette for the way back', () => {
    const { display } = createTestEnvironment({
      color: {
        field: 'population',
        domain: ['EUR'],
        palette: ['red'],
      },
    }).createDisplay()
    display.setColorScale('none')
    expect(display.color.scale).toBe('none')
    display.setColorScale('categorical')
    expect(display.color).toMatchObject({
      field: 'population',
      scale: 'categorical',
      domain: ['EUR'],
      palette: ['red'],
    })
  })

  it('LD is the ld field, so it replaces the field and reads as the ld scale', () => {
    const { display } = createTestEnvironment({
      color: { field: 'population', domain: ['EUR'] },
    }).createDisplay()
    display.colorByLd()
    expect(display.color).toMatchObject({
      field: 'ld',
      scale: 'ld',
      domain: [],
    })
    expect(display.ldColoringActive).toBe(true)
    display.setColorScale('none')
    expect(display.color).toMatchObject({ field: 'ld', scale: 'none' })
    expect(display.ldColoringActive).toBe(false)
    display.colorByField('population')
    expect(display.color).toMatchObject({
      field: 'population',
      scale: 'categorical',
    })
  })

  it('refuses a scale the display cannot paint, and an undeclared key', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(() =>
      display.configuration.setSubschema('color', { scale: 'ld' }),
    ).toThrow()
    expect(() =>
      display.configuration.setSubschema('color', { colorBy: 'ld' }),
    ).toThrow('ManhattanColor takes value, field, scale, domain and palette')
  })

  it('offers the three schemes as one radio submenu, LD greyed without an adapter', () => {
    const { display } = createTestEnvironment({
      ldAdapter: false,
    }).createDisplay()
    const items = display.trackMenuItems()
    expect(labels(items)).toEqual(
      expect.arrayContaining(['Color by', 'Single color', 'Field...']),
    )
    const colorBy = items.find(i => 'label' in i && i.label === 'Color by')!
    const ld = ('subMenu' in colorBy ? resolveSubMenu(colorBy) : []).find(
      i => 'label' in i && i.label === 'LD to index SNP',
    )
    expect(ld && 'disabled' in ld ? ld.disabled : undefined).toBe(true)

    display.colorByField('population')
    expect(labels(display.trackMenuItems())).toContain('Field (population)...')
  })
})
