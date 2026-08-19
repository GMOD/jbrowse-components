export {
  ConfigurationReference,
  ConfigurationSchema,
  hydrateTrackConfig,
} from './configurationSchema.ts'
export type { ConfigurationSchemaDefinition } from './configurationSchema.ts'

export type {
  AnyConfiguration,
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  AnyConfigurationSnapshot,
  ConfigModelForFields,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotValue,
  ConfigurationSnapshot,
  HostChecksSlotNames,
} from './types.ts'

export {
  getConfigurationSchemaDefinition,
  // exported for scripts/generateConfigManifest.ts, which needs the
  // preProcessSnapshot off a schema whose pluggable type does not expose one —
  // TextSearchAdapterType, where the shorthand is nonetheless the documented
  // way to write the config
  getConfigurationSchemaMetadata,
} from './schemaRegistry.ts'
export {
  getTypeNamesFromExplicitlyTypedUnion,
  isBareConfigurationSchemaType,
  isConfigurationModel,
  isConfigurationSchemaType,
  isConstantEntry,
  isSlotDefinitionEntry,
} from './schemaTypes.ts'
export { FormatAboutConfigSchemaFactory } from './formatAboutConfigSchema.ts'
export {
  DEFAULT_FORMAT_DETAILS_DEPTH,
  FormatDetailsConfigSchemaFactory,
} from './formatDetailsConfigSchema.ts'
export { mergeFormatCallbacks } from './mergeFormatCallbacks.ts'
export {
  readConfObject,
  readConfSlot,
  readConfigValue,
} from './readConfObject.ts'
export { getConf, resolveConf, setConf } from './getConf.ts'
export { expandTabixShorthand, tabixIndexSnapshot } from './tabixShorthand.ts'
export { tabixIndexFields } from './tabixIndexFields.ts'
export { evaluateJexl, isCallbackValue } from './slotValueUtils.ts'
export { toCallbackValue, toFixedValue } from './configurationSlot.ts'
export {
  getSlotDefinition,
  isConfigurationSlot,
  makeSlotFacade,
  preProcessSlotValues,
  slotChoices,
} from './slotFacade.ts'
export type { SlotFacade } from './slotFacade.ts'
export type { ResolvableDisplay } from './promotableResolve.ts'
export {
  clearPromotedDefaults,
  getDisplayTypeDefaultChanges,
  isSlotCustomized,
  makePin,
  getConfigSnapshotWithPromotables,
  getTrackConfigWithPromotables,
} from './promotableDefaults.ts'
export type { Pin, TrackConfigWithPromotables } from './promotableDefaults.ts'
