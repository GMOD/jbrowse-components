import { readConfObject } from '@jbrowse/core/configuration'
import { canonicalAssemblyNames } from '@jbrowse/core/util/tracks'

import { allVsAllTypes, syntenyTypes } from '../syntenyTypes.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AssemblyNameResolver } from '@jbrowse/core/util/tracks'

// The adapter's type, read the way the faceted selector reads it for its own
// adapter column: `type` is the schema's own literal on a live config node and
// a plain string on the frozen object a config track is (ADR-032), so it needs
// no slot reader — and reading it directly avoids snapshotting the whole
// adapter sub-config once per track.
function adapterType(conf: AnyConfigurationModel) {
  const adapter = conf.adapter as { type?: unknown } | undefined
  return typeof adapter?.type === 'string' ? adapter.type : undefined
}

/**
 * What a synteny track's row says it compares against, from the point of view
 * of the assembly the view is showing.
 *
 * Four shapes, and which one applies is a property of the *adapter* rather than
 * of how many assemblies are listed — an all-vs-all file with two loaded
 * assemblies still draws against every sample in it, so counting the list would
 * get the one case that matters wrong.
 */
export function syntenyMateLabel({
  trackAssemblyNames,
  viewAssemblyNames,
  adapterType: type,
  assemblyManager,
}: {
  trackAssemblyNames: string[]
  viewAssemblyNames: string[]
  adapterType: string
  assemblyManager: AssemblyNameResolver
}) {
  // In a synteny view an all-vs-all file is asked for one band at a time and
  // keeps only that pair's records. A plain LGV has no band to isolate, so the
  // track draws its assembly against every OTHER sample in the file —
  // including samples never listed in assemblyNames, which only says which
  // assemblies the track should appear on. Naming the listed ones here would
  // promise a mate set the track does not honour.
  if (allVsAllTypes.includes(type)) {
    return {
      label: 'vs all samples',
      detail:
        'Draws this assembly against every sample in the file, including samples not configured as assemblies',
    }
  }
  const anchors = new Set(
    canonicalAssemblyNames(viewAssemblyNames, assemblyManager),
  )
  // multiplicity is irrelevant once the anchor is known: [hg38, hg38] against a
  // view on hg38 leaves nothing, which is exactly what a self-alignment is
  const mates = [
    ...new Set(
      canonicalAssemblyNames(trackAssemblyNames, assemblyManager).filter(
        name => !anchors.has(name),
      ),
    ),
  ]
  if (mates.length === 0) {
    return {
      // "vs self" rather than "self-alignment": every suffix in the column
      // starts with "vs", so the shapes line up and read as one vocabulary
      label: 'vs self',
      detail: 'Aligns this assembly against itself',
    }
  }
  return mates.length === 1
    ? {
        label: `vs ${mates[0]}`,
        detail: `Compares this assembly against ${mates[0]}`,
      }
    : {
        label: `vs ${mates.length} assemblies`,
        detail: `Compares this assembly against ${mates.join(', ')}`,
      }
}

/**
 * The adornment for one track, or undefined for a track this plugin has nothing
 * to say about.
 *
 * A view with no assemblies yet gets nothing rather than a guess: the label is
 * entirely relative to what the view is anchored on, and "vs 2 assemblies" for
 * a pairwise track is the answer you get by treating an unknown anchor as no
 * anchor.
 */
export function syntenyRowAdornment({
  conf,
  viewAssemblyNames,
  assemblyManager,
}: {
  conf: AnyConfigurationModel
  viewAssemblyNames: string[]
  assemblyManager: AssemblyNameResolver
}) {
  const type = adapterType(conf)
  if (!type || !syntenyTypes.includes(type) || viewAssemblyNames.length === 0) {
    return undefined
  }
  const trackAssemblyNames = readConfObject(conf, 'assemblyNames') as
    | string[]
    | undefined
  if (!trackAssemblyNames?.length) {
    return undefined
  }
  return syntenyMateLabel({
    trackAssemblyNames,
    viewAssemblyNames,
    adapterType: type,
    assemblyManager,
  })
}
