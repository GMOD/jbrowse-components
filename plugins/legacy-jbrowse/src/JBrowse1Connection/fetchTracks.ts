import type { FileLocation } from '@jbrowse/core/util'

export async function fetchJBrowse1Tracks(
  config: Record<string, unknown>,
) {
  const dataDirLocation = config.dataDirLocation as FileLocation
  const assemblyNames = (config.assemblyNames as string[] | undefined) ?? []
  const assemblyName = assemblyNames[0]
  if (!assemblyName) {
    throw new Error('assembly name required for JBrowse 1 connection')
  }
  const { fetchJb1 } = await import('./jb1ConfigLoad.ts')
  const { convertTrackConfig } = await import('./jb1ToJb2.ts')
  const jb1Config = await fetchJb1(dataDirLocation)
  // @ts-expect-error
  return (jb1Config.tracks ?? []).map(jb1Track => ({
    ...convertTrackConfig(jb1Track, jb1Config.dataRoot || ''),
    assemblyNames: [assemblyName],
  }))
}
