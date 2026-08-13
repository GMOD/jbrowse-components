import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * The track-scan fixtures, shared so that a member added to what these helpers
 * take of an assembly manager is added once. Each suite still declares its own
 * `jest.mock('@jbrowse/core/configuration')` — the mock is hoisted per module
 * registry — and this factory matches the shape those mocks read.
 */
export const track = (trackId: string, type: string, assemblyNames: string[]) =>
  ({
    trackId,
    type,
    configuration: { assemblyNames },
  }) as unknown as AnyConfigurationModel

/**
 * 'aliasOfA' is another name for assembly 'a'; 'ghost' is named by a track and
 * configured by nothing, which is what the real manager answers undefined and
 * false for; every other name is its own.
 */
export const assemblyManager = {
  getCanonicalAssemblyName: (name: string) =>
    name === 'aliasOfA' ? 'a' : name === 'ghost' ? undefined : name,
  has: (name: string) => name !== 'ghost',
}

/**
 * The startup window: configs exist, so `has` answers, but the manager's
 * afterAttach autorun hasn't built the models `getCanonicalAssemblyName` reads.
 * A screen written on the latter empties its list here — see SessionAssemblies.
 */
export const loadingAssemblyManager = {
  getCanonicalAssemblyName: () => undefined,
  has: () => true,
}
