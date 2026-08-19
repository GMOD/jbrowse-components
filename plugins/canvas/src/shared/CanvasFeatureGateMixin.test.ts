import { getConf } from '@jbrowse/core/configuration'

import type { GateHost } from './CanvasFeatureGateMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'

// The gate reads one config slot, `maxFeatureScreenDensity`, through a host cast
// it declares itself. Cast to `AnyConfigurationModel` and that read checks
// nothing and a typo answers `undefined` forever, which reads as a gate that
// never fires.
const gatePin: HostChecksSlotNames<GateHost> = true

test('the host type checks the slot name the gate reads through it', () => {
  const host = {} as GateHost
  const read = () => {
    // @ts-expect-error
    return getConf(host, 'maxFeatureScreenDensty')
  }
  expect([gatePin, read]).toHaveLength(2)
})
