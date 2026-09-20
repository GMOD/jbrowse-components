import { getConf } from '@jbrowse/core/configuration'

import type {
  AnyConfigurationModel,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotValue,
} from '@jbrowse/core/configuration'

type SlotViews<CONF, NAME extends string> = {
  readonly [K in NAME]: ConfigurationSlotValue<
    ConfigurationSchemaForModel<CONF>,
    K
  >
}

export function slotViews<
  CONF extends AnyConfigurationModel,
  const NAME extends ConfigurationSlotName<ConfigurationSchemaForModel<CONF>>,
>(self: { configuration: CONF }, names: readonly NAME[]) {
  const views = {}
  for (const name of names) {
    Object.defineProperty(views, name, {
      enumerable: true,
      configurable: true,
      get: () => getConf(self, name),
    })
  }
  return views as SlotViews<CONF, NAME>
}
