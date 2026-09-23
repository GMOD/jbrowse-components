import {
  ConfigurationSchema,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { rowArrangementConfigSchema } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { TreeSidebarMixin } from './TreeSidebarMixin.ts'
import { treeSidebarConfigSchemaFields } from './treeSidebarConfigSchemaFields.ts'

import type { TreeSidebarHost } from './TreeSidebarMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'

// The arrangement itself is exercised through the four row displays'
// rowDerivation suites: a bare model has no track, no session and no base
// config to compare against. What this file pins is the type-level half: widen
// the host back to `AnyConfigurationModel` and every slot name below stops
// being checked, with a misspelled read reporting nothing at any layer.
const treeSidebarPin: HostChecksSlotNames<TreeSidebarHost> = true

test('the host type checks the slot names the mixin reads through it', () => {
  expect(treeSidebarPin).toBe(true)
  const host = {} as TreeSidebarHost
  const read = () => {
    // @ts-expect-error
    return getConf(host, 'showTrea')
  }
  const readMember = () => {
    // @ts-expect-error
    return getConf(host, ['rows', 'order'])
  }
  const write = () => {
    // @ts-expect-error
    setConf(host, ['rows', 'order'], [])
  }
  const readColor = () => {
    // @ts-expect-error
    return getConf(host, ['rowColour', 'domain'])
  }
  const writeColor = () => {
    // @ts-expect-error
    setConf(host, ['rowColor', 'domains'], [])
  }
  expect([read, readMember, write, readColor, writeColor]).toHaveLength(5)
})

const configSchema = ConfigurationSchema('TestTreeDisplay', {
  ...treeSidebarConfigSchemaFields({
    tree: 'show the tree',
    rowLabels: 'draw each row name',
  }),
  rows: rowArrangementConfigSchema,
  rowColor: rowColorConfigSchema,
})

function makeDisplay(configuration: Record<string, unknown> = {}) {
  return types
    .compose(
      'TestTreeDisplay',
      TreeSidebarMixin(),
      types.model({
        type: types.literal('TestTreeDisplay'),
        configuration: configSchema,
      }),
    )
    .create({ type: 'TestTreeDisplay', configuration })
}

// Each case flips ONE slot off a true default and asserts only that toggle
// moved. Cross-wiring is the failure this is shaped for — the three bodies are
// character-identical but for the slot name, so a copy-paste reads correctly and
// answers for the wrong setting. Inverting `showBranchLength` once left all
// 3,698 tests across the four composing plugins green.
describe('the tree toggles', () => {
  const toggles = [
    ['showTree', 'setShowTree'],
    ['showBranchLength', 'setShowBranchLength'],
    ['showRowLabels', 'setShowRowLabels'],
  ] as const

  const others = (slot: string) => toggles.filter(([n]) => n !== slot)

  it.each(toggles)('%s defaults on and reads its own slot', slot => {
    expect(makeDisplay()[slot]).toBe(true)
    const off = makeDisplay({ [slot]: false })
    expect(off[slot]).toBe(false)
    for (const [other] of others(slot)) {
      expect(off[other]).toBe(true)
    }
  })

  it.each(toggles)('%s is written by its own setter', (slot, setter) => {
    const m = makeDisplay()
    m[setter](false)
    expect(m[slot]).toBe(false)
    for (const [other] of others(slot)) {
      expect(m[other]).toBe(true)
    }
  })
})

// A display that overrides no hook still derives: no rows, and nothing to
// arrange.
describe('the declared hooks', () => {
  it('derive empty rows before a display supplies any', () => {
    const display = makeDisplay({ rows: { domain: ['a'] } })
    expect(display.discoveredRows).toEqual([])
    expect(display.editableSources).toEqual([])
    expect(display.clusterableSources).toEqual([])
    expect(display.identityChannel).toBe('color')
    expect(display.unlistedRowsSort).toBe('source')
    expect(display.rowOrder).toEqual(['a'])
  })
})

// A display supplies its rows the way every display supplies `autoRowHeight`:
// a getter in a later `.views` block, over state of its own.
describe('a display supplying the hooks', () => {
  function makeSupplied() {
    return types
      .compose(
        'SuppliedTreeDisplay',
        TreeSidebarMixin(),
        types.model({
          type: types.literal('SuppliedTreeDisplay'),
          configuration: configSchema,
        }),
      )
      .volatile(() => ({ names: ['a', 'b', 'c'] }))
      .views(self => ({
        get discoveredRows() {
          return self.names.map(name => ({ name }))
        },
        get identityChannel(): 'color' | 'labelColor' {
          return 'labelColor'
        },
      }))
      .create({
        type: 'SuppliedTreeDisplay',
        configuration: {
          rows: { domain: ['c'], labels: { a: 'Ay' }, kept: ['a', 'c'] },
          rowColor: { domain: ['b'], range: ['#00f'] },
        },
      })
  }

  it('derives the arranged and the focused rows from them', () => {
    const display = makeSupplied()
    expect(display.editableSources).toEqual([
      { name: 'c' },
      { name: 'a', label: 'Ay' },
      { name: 'b', labelColor: '#00f' },
    ])
    expect(display.clusterableSources.map(r => r.name)).toEqual(['c', 'a'])
  })

  it('refuses a volatile over a declared hook', () => {
    expect(() =>
      types
        .compose(
          'VolatileTreeDisplay',
          TreeSidebarMixin(),
          types.model({ configuration: configSchema }),
        )
        .volatile(() => ({ discoveredRows: [] }))
        .create({ configuration: {} }),
    ).toThrow()
  })
})
