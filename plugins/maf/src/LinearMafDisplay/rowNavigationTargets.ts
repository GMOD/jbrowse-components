import { findRowSpans } from './components/findRowSpan.ts'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafSource } from '../types.ts'
import type { RowSpan } from './components/findRowSpan.ts'
import type { UriLocation } from '@jbrowse/core/util'
import type { SessionAssemblies } from '@jbrowse/core/util/tracks'

export interface RowNavigationTarget extends RowSpan {
  assemblyName: string
  assemblyConfigLocation?: UriLocation
  sampleLabel: string
  rowIndex: number
}

export interface RowNavigationInputs {
  sources: readonly MafSource[]
  assemblies: SessionAssemblies
  detail: ReadonlyMap<number, MafRegionData>
  displayedRegionIndex: number
  startBp: number
  endBp: number
  startRow: number
  endRow: number
}

/**
 * Where rows `[startRow, endRow)` sit in their own genomes across the
 * reference bp range `[startBp, endBp)`. A row with no aligned base in the
 * range or no fetched block covering it contributes nothing, and so does one
 * whose genome the session has no assembly for and no `assemblyConfigLocation`
 * to load it from. A sample id that names a loaded assembly stands in for a
 * missing `assemblyName`. A target names its assembly canonically, the one
 * spelling its view and synteny track can key on; a name still to be loaded
 * from its `assemblyConfigLocation` keeps the spelling that config uses.
 */
export function rowNavigationTargetsOf({
  sources,
  assemblies,
  detail,
  displayedRegionIndex,
  startBp,
  endBp,
  startRow,
  endRow,
}: RowNavigationInputs) {
  const assemblyNames = new Map<number, string>()
  for (
    let row = Math.max(0, startRow);
    row < Math.min(endRow, sources.length);
    row++
  ) {
    const { name, assemblyName: named, assemblyConfigLocation } = sources[row]!
    const assemblyName = named ?? name
    if (
      assemblies.has(assemblyName) ||
      (named !== undefined && assemblyConfigLocation !== undefined)
    ) {
      assemblyNames.set(
        row,
        assemblies.getCanonicalAssemblyName(assemblyName) ?? assemblyName,
      )
    }
  }
  const region = assemblyNames.size
    ? detail.get(displayedRegionIndex)
    : undefined
  const spans = region
    ? findRowSpans(region, startBp, endBp, new Set(assemblyNames.keys()))
    : undefined
  const targets: RowNavigationTarget[] = []
  for (const [rowIndex, assemblyName] of assemblyNames) {
    const span = spans?.get(rowIndex)
    const source = sources[rowIndex]!
    if (span) {
      targets.push({
        ...span,
        assemblyName,
        assemblyConfigLocation: source.assemblyConfigLocation,
        sampleLabel: source.label,
        rowIndex,
      })
    }
  }
  return targets
}
