import { getConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { LD_LEGEND_TITLE } from './ldBins.ts'
import { createTestEnvironment } from './testEnv.ts'

import type {
  ManhattanCategory,
  ManhattanRpcResult,
} from '../ManhattanRPC/rpcTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}

function payload(categories?: ManhattanCategory[]): ManhattanRpcResult {
  return {
    positions: new Uint32Array([100]),
    ends: new Uint32Array([101]),
    glyphs: new Uint8Array([0]),
    scores: new Float32Array([3]),
    colors: new Uint32Array([0xff_00_00_ff]),
    numFeatures: 1,
    scoreMin: 3,
    scoreMax: 3,
    flatbushData: undefined,
    categories,
  }
}

function labels(items: MenuItem[]): string[] {
  return items.flatMap(i => [
    'label' in i && typeof i.label === 'string' ? i.label : '',
    ...('subMenu' in i ? labels(resolveSubMenu(i)) : []),
  ])
}

describe('LinearManhattanDisplay field coloring', () => {
  it('derives the color key from the payloads, merged across regions and sorted numerically', () => {
    const { display } = createTestEnvironment({
      colorBy: 'field',
    }).createDisplay()
    expect(display.legend).toBeUndefined()

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
    expect(display.legend).toEqual({
      title: 'name',
      items: [
        { label: 'chr1', color: '#333333' },
        { label: 'chr2', color: '#222222' },
        { label: 'chr10', color: '#111111' },
      ],
    })
  })

  it('has no key under a single color, and the r² bins under LD coloring', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRpcData(0, payload(), REGION)
    expect(display.legend).toBeUndefined()

    const ld = createTestEnvironment({ colorBy: 'ld' }).createDisplay().display
    expect(ld.legend?.title).toBe(LD_LEGEND_TITLE)
  })

  it('colorByField sets the mode and the field together, and both reach the worker', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.colorByField('population')
    expect(getConf(display, 'colorBy')).toBe('field')
    expect(getConf(display, 'colorField')).toBe('population')
    expect(display.rpcProps()).toMatchObject({
      colorBy: 'field',
      colorField: 'population',
      scoreField: 'score',
    })
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
