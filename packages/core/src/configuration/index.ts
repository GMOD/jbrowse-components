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
  areSlotsAtSessionDefault,
  clearDisplaySessionDefaults,
  displaySessionDefaultChanges,
  getConfResolved,
  isSlotPinned,
  isSlotValueSessionDefault,
  makeCurrentValueSessionDefaultControl,
  makeSessionDefaultControl,
  makeSlotsValueSessionDefaultControl,
  resolvePromotableConfigSnapshot,
  setSlotValueSessionDefault,
  setSlotsSessionDefault,
} from './promotableDefaults.ts'
export type {
  PromotableDisplay,
  SessionDefaultControl,
} from './promotableDefaults.ts'
