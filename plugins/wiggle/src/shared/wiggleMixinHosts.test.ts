import { getConf, setConf } from '@jbrowse/core/configuration'

import type { WiggleCommonHost } from './WiggleCommonMixin.ts'
import type { ConfNode as WiggleScoreConfigHost } from './WiggleScoreConfigMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'

// The two wiggle mixins both cast to reach their composing display's
// `configuration`, and what they cast to decides whether the slot names below
// are checked at all. Both once used `ResolvableDisplay & { configuration: X }`,
// which reads like a narrowing and re-widens; the mechanism is pinned in core's
// `configTypeNarrowing.test.ts` and this is the per-mixin half.
const wiggleCommonPin: HostChecksSlotNames<WiggleCommonHost> = true
const wiggleScoreConfigPin: HostChecksSlotNames<WiggleScoreConfigHost> = true

test('both hosts check the slot names their mixin reads', () => {
  const common = {} as WiggleCommonHost
  const score = {} as WiggleScoreConfigHost
  const reads = () => [
    // @ts-expect-error
    getConf(common, 'posColour'),
    // @ts-expect-error
    getConf(score, 'displayCrossHatche'),
  ]
  const writes = () => {
    // @ts-expect-error
    setConf(common, 'posColour', 'red')
    // @ts-expect-error
    setConf(score, 'displayCrossHatche', true)
  }
  expect([wiggleCommonPin, wiggleScoreConfigPin, reads, writes]).toHaveLength(4)
})

// A checked name is not the same as a name every composer declares, and
// `HostChecksSlotNames` above only asks the first. `LinearManhattanDisplay`
// composes WiggleScoreConfigMixin against a schema holding the score axis and
// its own slots, so a wiggle-only slot reached through that host answers
// `undefined` at runtime with no diagnostic anywhere — which is how
// `symlogConstant` shipped one mixin too high once already. The narrower host is
// what makes it a compile error instead, and this is what says so.
test('the score-config host cannot reach a slot only wiggle declares', () => {
  const common = {} as WiggleCommonHost
  const score = {} as WiggleScoreConfigHost
  const reads = () => [
    getConf(common, 'symlogConstant'),
    // @ts-expect-error
    getConf(score, 'symlogConstant'),
    // @ts-expect-error
    getConf(score, 'posColor'),
  ]
  expect([reads]).toHaveLength(1)
})
