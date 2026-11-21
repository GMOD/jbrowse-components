import { getConf, setConf } from '@jbrowse/core/configuration'

import {
  boundConnectorsBand,
  connectorsBandStack,
  dragConnectorsHeight,
} from './constants.ts'

import type { LDDisplayConfig } from '../LDDisplay/configSchemaLDTrack.ts'
import type { LinearVariantDisplayConfigModel } from '../LinearVariantDisplay/configSchema.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface ConnectorsBandHost {
  configuration: Instance<LinearVariantDisplayConfigModel> | LDDisplayConfig
}

export interface ConnectorsBandRules {
  trackHeight: () => number
  active: () => boolean
}

export function connectorsBandViews(
  self: ConnectorsBandHost,
  { trackHeight, active }: ConnectorsBandRules,
) {
  return {
    /**
     * #getter
     * The `connectors` band above the plot it ties to the genome, taken from
     * the track height so the plot keeps its floor.
     */
    get connectorsBand() {
      return boundConnectorsBand(trackHeight(), {
        active: active(),
        height: getConf(self, ['connectors', 'height']),
      })
    },
  }
}

export function connectorsStackViews(
  self: ReturnType<typeof connectorsBandViews>,
) {
  return {
    /**
     * #getter
     */
    get connectorsStack() {
      return connectorsBandStack(self.connectorsBand)
    },
  }
}

export function connectorsHeightViews(
  self: ReturnType<typeof connectorsStackViews>,
) {
  return {
    /**
     * #getter
     */
    get connectorsHeight(): number {
      return self.connectorsStack.reserved.connectors
    },
  }
}

export function connectorsBandActions(
  self: ConnectorsBandHost & ReturnType<typeof connectorsStackViews>,
  { trackHeight }: Pick<ConnectorsBandRules, 'trackHeight'>,
) {
  return {
    /**
     * #action
     */
    setConnectorsHeight(n: number) {
      setConf(
        self,
        ['connectors', 'height'],
        dragConnectorsHeight(self.connectorsStack, trackHeight(), n),
      )
    },
  }
}
