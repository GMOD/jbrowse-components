import { types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from './configurationSchema.ts'
import { getConf, writeConf } from './index.ts'

import type { HostChecksSlotNames } from './types.ts'

// What candidate N rests on: that a config node's typed props make a drilled
// node checked by themselves, with no annotation. Measured against
// `variant-d.patch` as handed over, and the answer is no — the patch widens
// `ConfigurationSchemaForModel` back to the model type, so the host pin reads
// `false`, `getConf`'s path check is off with it, and a sub-schema name that
// does not exist compiles. Flip the two `false`s below and the three
// `@ts-expect-error`s back on when the patch's own errors are fixed; that is
// the run that would say candidate N delivers its check.

const valueScale = ConfigurationSchema('ValueScale', {
  type: {
    type: 'stringEnum',
    model: types.enumeration('', ['linear', 'log']),
    defaultValue: 'linear',
  },
  domainMin: { type: 'maybeNumber' },
})

const scales = ConfigurationSchema('Scales', { y: valueScale })

const display = ConfigurationSchema('Display', {
  height: { type: 'number', defaultValue: 100 },
  scales,
})

const holder = types.model({ configuration: display })
type Host = typeof holder.Type

const hostPin: HostChecksSlotNames<Host> = false

test('a drilled node is not checked under the typed-props patch', () => {
  const host = {} as Host

  const readsThroughAPath = () => getConf(host, ['scales', 'y', 'domainMinn'])
  const writesADrilledNode = () => {
    writeConf(host.configuration.scales.y, 'domainMinn', 0)
  }
  const drillsAMemberThatIsNotThere = () => host.configuration.scales.z
  const writesTheObjectWhole = () => {
    writeConf(host.configuration, 'scales', { y: { type: 'log' } })
  }

  expect([
    hostPin,
    readsThroughAPath,
    writesADrilledNode,
    drillsAMemberThatIsNotThere,
    writesTheObjectWhole,
  ]).toHaveLength(5)
})
