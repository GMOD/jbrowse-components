export {
  ConfigurationReference,
  ConfigurationSchema,
} from './configurationSchema.ts'
export type { ConfigurationSchemaDefinition } from './configurationSchema.ts'

export type {
  AnyConfiguration,
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  AnyConfigurationSnapshot,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotValue,
} from './types.ts'

export {
  getConfigurationSchemaDefinition,
  getTypeNamesFromExplicitlyTypedUnion,
  isBareConfigurationSchemaType,
  isConfigurationModel,
  isConfigurationSchemaType,
  isConstantEntry,
  isSlotDefinitionEntry,
  readConfObject,
  readConfigValue,
} from './util.ts'
export { getConf, resolveConf, setConf } from './getConf.ts'
export { evaluateJexl, isCallbackValue } from './slotValueUtils.ts'
export { toCallbackValue, toFixedValue } from './configurationSlot.ts'
export {
  getSlotDefinition,
  isConfigurationSlot,
  makeSlotFacade,
  preProcessSlotValues,
} from './slotFacade.ts'
export type { SlotFacade } from './slotFacade.ts'
export type { PromotableDisplay } from './promotableResolve.ts'
export {
  clearPromotedDefaults,
  getDisplayTypeDefaultChanges,
  isSlotCustomized,
  makeCurrentValueDisplayTypeDefaultControl,
  makeDisplayTypeDefaultControl,
  openPromotableDisplays,
  getConfigSnapshotWithPromotables,
} from './promotableDefaults.ts'
export type { DisplayTypeDefaultControl } from './promotableDefaults.ts'
