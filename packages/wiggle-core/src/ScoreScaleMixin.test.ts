import { getConf, writeConf } from '@jbrowse/core/configuration'

import type { ScoreScaleHost } from './ScoreScaleMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'

// On main this pin reads `true` and both calls below carry a used
// `@ts-expect-error`. Under `variant-d.patch` — the typed config-node props
// candidate N is built on — it reads `false` and neither call is an error any
// more: the patch widens `ConfigurationSchemaForModel` back to the model type,
// so the mixin's host stops narrowing its own member names, on the read side as
// well as the write. `writeConfNarrowing.test.ts` is the same measurement on a
// schema declared in one file, which rules out anything about this mixin.
const scoreScalePin: HostChecksSlotNames<ScoreScaleHost> = false

test('the host no longer checks the member names the mixin goes through', () => {
  const host = {} as ScoreScaleHost
  const read = () => getConf(host, ['scales', 'y', 'domainMinn'])
  const write = () => {
    writeConf(host.configuration.scales.y, 'domainMinn', 0)
  }
  expect([scoreScalePin, read, write]).toHaveLength(3)
})
