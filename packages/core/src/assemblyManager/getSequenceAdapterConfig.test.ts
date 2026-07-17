import { getSequenceAdapterConfig } from './getSequenceAdapterConfig.ts'

// Guards the missing-assembly path: callers like searchModes previously did
// getSnapshot(get(name)?.configuration.sequence.adapter), which throws when the
// assembly (or its config) is absent. The helper must return undefined instead.
test('returns undefined when the assembly is missing', () => {
  expect(getSequenceAdapterConfig(undefined)).toBeUndefined()
})

test('returns undefined when the assembly config is unresolved', () => {
  expect(getSequenceAdapterConfig({ configuration: undefined })).toBeUndefined()
})
