export {
  ConfigurationReference,
  ConfigurationSchema,
  hydrateTrackConfig,
} from './configurationSchema.ts'
export type { ConfigurationSchemaDefinition } from './configurationSchema.ts'
// Named in the shape `ConfigurationSchema()` returns, so every downstream
// `configSchema` declaration emit has to be able to reach them by name.
export type { ConfigSlotDefinition } from './configurationSlot.ts'

export type {
  AnyConfiguration,
  AnyConfigurationModel,
  AnyConfigurationSchemaType,
  AnyConfigurationSnapshot,
  ConfigModelForFields,
  ConfigNodeActions,
  ConfigNodeBrand,
  ConfigNodeProps,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotPath,
  ConfigurationSlotPathValue,
  ConfigurationSlotValue,
  ConfigurationSnapshot,
  HostChecksSlotNames,
  IdentifierSlotDef,
  TypeSlotDef,
} from './types.ts'

export {
  getConfigurationSchemaDefinition,
  getConfigurationSchemaOptions,
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
export { readConfObject, readConfigValue } from './readConfObject.ts'
export { getConf, setConf } from './getConf.ts'
export { fillLocations } from './fillLocations.ts'
export {
  preProcessConfigSnapshot,
  preProcessSnapshotWith,
  shorthandForm,
} from './snapshotPreprocess.ts'
export { expandTabixShorthand, tabixIndexSnapshot } from './tabixShorthand.ts'
export { tabixIndexFields } from './tabixIndexFields.ts'
export { evaluateJexl, isCallbackValue } from './slotValueUtils.ts'
export { toCallbackValue, toFixedValue } from './configurationSlot.ts'
export {
  getSlotDefinition,
  isConfigurationSlot,
  isConfigurationSubschema,
  makeSlotFacade,
  mergedSubschemaValue,
  preProcessSlotValues,
  slotChoices,
  slotValueRefusal,
} from './slotFacade.ts'
export type { SlotFacade } from './slotFacade.ts'
export { fullConfSnapshot } from './fullConfSnapshot.ts'
