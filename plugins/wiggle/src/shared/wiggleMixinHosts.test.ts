import { getConf, setConf } from '@jbrowse/core/configuration'

import type { WiggleCommonHost } from './WiggleCommonMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'
import type { WiggleScoreConfigHost } from '@jbrowse/wiggle-core'

// A host widened to `AnyConfigurationModel` switches the slot-name check off
// with no symptom, so the mixin names its own field table.
const wiggleCommonPin: HostChecksSlotNames<WiggleCommonHost> = true

test('the common host checks the slot names its mixin reads', () => {
  const common = {} as WiggleCommonHost
  const reads = () => [
    // @ts-expect-error
    getConf(common, 'posColour'),
  ]
  const writes = () => {
    // @ts-expect-error
    setConf(common, 'posColour', 'red')
  }
  expect([wiggleCommonPin, reads, writes]).toHaveLength(3)
})

// `HostChecksSlotNames` asks whether names are checked, not whether every
// composer declares them. `WiggleScoreConfigMixin`'s composers include displays
// declaring none of wiggle's own slots, so reaching one through its host is a
// compile error rather than a silent `undefined`.
test('the score-config host cannot reach a slot only wiggle declares', () => {
  const common = {} as WiggleCommonHost
  const score = {} as WiggleScoreConfigHost
  const reads = () => [
    getConf(common, 'origin'),
    // @ts-expect-error
    getConf(score, 'origin'),
  ]
  expect([reads]).toHaveLength(1)
})
