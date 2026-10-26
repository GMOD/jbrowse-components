import { setConf } from '@jbrowse/core/configuration'
import { onPatch } from '@jbrowse/mobx-state-tree'

import { writtenReadCategoryColors } from '../shared/alignmentsColor.ts'
import { bootAlignmentsDisplay } from './testUtils.ts'

function createDisplay(displayConfig: Record<string, unknown> = {}) {
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [
        { type: 'LinearAlignmentsDisplay', displayId: 'd1', ...displayConfig },
      ],
    },
  })
  const Session = baseSession.volatile(() => ({ rpcManager: {} }))
  return mount(Session, { configuration: 'd1' }).display
}

function patchesOf(
  display: ReturnType<typeof createDisplay>,
  write: () => void,
) {
  const patches: unknown[] = []
  const dispose = onPatch(display.configuration, patch => {
    patches.push(patch)
  })
  write()
  dispose()
  return patches
}

// An all-default `scale: {}` read back off the node must compare equal to
// the write, or every repeat pick rewrites the channel and re-bakes the reads.
describe('a pick of what already paints writes nothing', () => {
  test('colorByField of the painting field', () => {
    const display = createDisplay({
      encoding: { color: { field: 'tags.HP' } },
    })
    expect(
      patchesOf(display, () => {
        display.colorByField('tags.HP')
      }),
    ).toEqual([])
  })

  test('colorByField of a field with a written scale', () => {
    const display = createDisplay({
      encoding: {
        color: { field: 'tags.HP', scale: { domain: ['1'], range: ['red'] } },
      },
    })
    expect(
      patchesOf(display, () => {
        display.colorByField('tags.HP')
      }),
    ).toEqual([])
  })

  test('setColorValue of the painting constant', () => {
    const display = createDisplay({
      encoding: { color: { value: 'steelblue' } },
    })
    expect(
      patchesOf(display, () => {
        display.setColorValue('steelblue')
      }),
    ).toEqual([])
  })

  test('setBases of the layer already drawn', () => {
    const display = createDisplay({
      pileup: { bases: { show: true, encoding: { color: 'baseQuality' } } },
    })
    expect(
      patchesOf(display, () => {
        display.setBases({ show: true, field: 'baseQuality' })
      }),
    ).toEqual([])
  })
})

// The key's own members are read apart from what paints, so editing them
// re-bakes no read and refetches nothing.
describe('a key-only edit reaches neither the bake nor the fetch', () => {
  test.each([
    [
      ['encoding', 'color', 'scale', 'names'],
      ['Maternal', 'Paternal'],
    ],
    [['encoding', 'color', 'legend', 'title'], 'Haplotype'],
    [['encoding', 'color', 'legend', 'descending'], true],
  ] as const)('%j', (path, value) => {
    const display = createDisplay({
      encoding: { color: { field: 'tags.HP', scale: { domain: ['1', '2'] } } },
    })
    const context = display.readColorContext
    const fetch = display.rpcProps()
    setConf(display, path as never, value)
    expect(display.readColorContext).toBe(context)
    expect(display.rpcProps()).toStrictEqual(fetch)
  })
})

describe('scale.invalid paints a read with no value under the field', () => {
  test('the no-value read takes it and the plain read keeps the theme', () => {
    const display = createDisplay({
      encoding: { color: { field: 'tags.HP', scale: { invalid: '#00ff00' } } },
    })
    const colors = writtenReadCategoryColors(
      display.colorSetting,
      display.colorEncoding,
    )
    expect(colors.noTagValue).toEqual([0, 1, 0])
    expect(colors).not.toHaveProperty('plain')
  })
})

describe('the Line width menu keeps the widening with support', () => {
  test('a width is the one-read end of the default curve', () => {
    const display = createDisplay()
    const defaults = display.readConnectionsStrokeScale
    display.setReadConnectionsStrokeWidth(2)
    expect(display.readConnectionsStrokeWidth).toBe(2)
    expect(display.readConnectionsStrokeScale).toEqual({
      ...defaults,
      range: defaults.range.map(px => px * 2),
    })
  })

  test('1 px draws what unset draws, and a reset unsets it', () => {
    const display = createDisplay()
    const defaults = display.readConnectionsStrokeScale
    display.setReadConnectionsStrokeWidth(1)
    expect(display.readConnectionsStrokeScale).toEqual(defaults)
    display.setReadConnectionsStrokeWidth()
    expect(display.readConnectionsStrokeScale).toEqual(defaults)
  })
})
