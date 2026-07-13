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
  clearPromotedDefaults,
  getConfResolved,
  getDisplayTypeDefaultChanges,
  makeCurrentValueDisplayTypeDefaultControl,
  makeDisplayTypeDefaultControl,
  makeSlotsValueDisplayTypeDefaultControl,
  resolvePromotableConfigSnapshot,
} from './promotableDefaults.ts'
export type {
  DisplayTypeDefaultControl,
  PromotableDisplay,
} from './promotableDefaults.ts'
