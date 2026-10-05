import type { TrackConfigEntry } from '@jbrowse/core/configuration'

/**
 * A track-scan fixture, shaped as `session.tracks` holds one: a frozen entry.
 * Shared so that a member added to what these helpers take of an assembly
 * manager is added once.
 */
export const track = (
  trackId: string,
  type: string,
  assemblyNames: string[],
): TrackConfigEntry => ({ trackId, type, assemblyNames })

/**
 * 'aliasOfA' is another name for assembly 'a'; 'ghost' is named by a track and
 * configured by nothing, so the real manager answers undefined and false for it;
 * every other name is its own.
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
