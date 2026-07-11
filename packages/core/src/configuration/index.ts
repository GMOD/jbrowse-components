export {
  ConfigurationReference,
  ConfigurationSchema,
} from './configurationSchema.ts'
export type { ConfigurationSchemaDefinition } from './configurationSchema.ts'

export type {
  AnyConfiguration,
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotValue,
} from './types.ts'

export * from './util.ts'
export { evaluateJexl, isCallbackValue } from './slotValueUtils.ts'
export { toCallbackValue, toFixedValue } from './configurationSlot.ts'
export {
  getSlotDefinition,
  isConfigurationSlot,
  makeSlotFacade,
} from './slotFacade.ts'
export type { SlotFacade } from './slotFacade.ts'
export {
  clearDisplaySessionDefaults,
  displaySessionDefaultChanges,
  getConfResolved,
  makeCurrentValueSessionDefaultControl,
  makeSessionDefaultControl,
  makeSlotsValueSessionDefaultControl,
  resolvePromotableConfigSnapshot,
} from './promotableDefaults.ts'
export type {
  PromotableDisplay,
  SessionDefaultControl,
} from './promotableDefaults.ts'
