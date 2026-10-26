import { findRowSpans } from './components/findRowSpan.ts'

import type { MafRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafSource } from '../types.ts'
import type { RowSpan } from './components/findRowSpan.ts'
import type { UriLocation } from '@jbrowse/core/util'

export interface RowNavigationTarget extends RowSpan {
  assemblyName: string
  assemblyConfigLocation?: UriLocation
  sampleLabel: string
  rowIndex: number
}

export interface RowNavigationInputs {
  sources: readonly MafSource[]
  hasAssembly: (name: string) => boolean
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
 * missing `assemblyName`.
 */
export function rowNavigationTargetsOf({
  sources,
  hasAssembly,
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
      hasAssembly(assemblyName) ||
      (named !== undefined && assemblyConfigLocation !== undefined)
    ) {
      assemblyNames.set(row, assemblyName)
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
