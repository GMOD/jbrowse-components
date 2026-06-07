export {
  ConfigurationReference,
  ConfigurationSchema,
} from './configurationSchema.ts'

export type {
  AnyConfiguration,
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  AnyConfigurationSlot,
  AnyConfigurationSlotType,
} from './types.ts'

export * from './util.ts'
export {
  evaluateJexl,
  isCallbackValue,
  toCallbackValue,
  toFixedValue,
} from './slotValueUtils.ts'
export {
  getSlotDefinition,
  isConfigurationSlot,
  makeSlotFacade,
} from './slotFacade.ts'
export type { SlotFacade } from './slotFacade.ts'
