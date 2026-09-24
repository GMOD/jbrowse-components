export {
  ConfigurationReference,
  ConfigurationSchema,
  hydrateTrackConfig,
} from './configurationSchema.ts'
export type { ConfigurationSchemaDefinition } from './configurationSchema.ts'
export {
  ConfigurationSchemaUnion,
  arraySlotUnion,
} from './configurationSchemaUnion.ts'
export type { ConfigurationSchemaUnionType } from './configurationSchemaUnion.ts'
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
  PluggableConfigNode,
  TypeSlotDef,
} from './types.ts'

export {
  getConfigurationSchemaDefinition,
  // exported for scripts/generateConfigManifest.ts, which needs the
  // preProcessSnapshot off a schema whose pluggable type does not expose one —
  // TextSearchAdapterType, where the shorthand is nonetheless the documented
  // way to write the config
  getConfigurationSchemaMetadata,
  getConfigurationSchemaUnion,
} from './schemaRegistry.ts'
export type { ConfigurationSchemaUnionMetadata } from './schemaRegistry.ts'
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
export { applyConfSettings, getConf, setConf } from './getConf.ts'
export type { ConfSettingsReport } from './getConf.ts'
export { fillLocations } from './fillLocations.ts'
export {
  preProcessConfigSnapshot,
  preProcessSnapshotWith,
  shorthandForm,
} from './snapshotPreprocess.ts'
export { requirementProblems } from './requirements.ts'
export type {
  ConfigurationSchemaRequirement,
  RequirementProblem,
} from './requirements.ts'
export { expandTabixShorthand, tabixIndexSnapshot } from './tabixShorthand.ts'
export { tabixIndexFields } from './tabixIndexFields.ts'
export { evaluateJexl, isCallbackValue } from './slotValueUtils.ts'
export { toCallbackValue, toFixedValue } from './configurationSlot.ts'
export {
  getSlotDefinition,
  isConfigurationSlot,
  makeSlotFacade,
  slotChoices,
  slotValueRefusal,
} from './slotFacade.ts'
export type { SlotFacade } from './slotFacade.ts'
export { fullConfSnapshot } from './fullConfSnapshot.ts'
