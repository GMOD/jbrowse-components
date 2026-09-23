import { getConf, setConf } from '@jbrowse/core/configuration'

import type { TreeSidebarHost } from './TreeSidebarMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'

// The arrangement itself is exercised through the quantitative display, the
// first to compose this mixin (`plugins/wiggle`'s rowDerivation and rowDomain
// suites): a bare model has no track, no session and no base config to compare
// against. What this file pins is the type-level half, the way
// `LayoutTreeSidebarMixin.test.ts` does for the display-state version: widen
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
  expect([read, readMember, write]).toHaveLength(3)
})
