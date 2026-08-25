import type { AssemblyHost, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * `visibleSpanOnRefName` for the contig a feature is on. The feature's refName
 * is the adapter's spelling and the blocks carry the view's, so the two meet on
 * the canonical name.
 */
export function visibleSpanOnFeature(
  host: AssemblyHost,
  view: LinearGenomeViewModel,
  feature: Feature,
) {
  const assemblyName = view.assemblyNames[0]
  const assembly =
    assemblyName === undefined
      ? undefined
      : host.assemblyManager.get(assemblyName)
  const refName = feature.get('refName')
  return visibleSpanOnRefName(
    view,
    assembly?.getCanonicalRefName2(refName) ?? refName,
  )
}

/**
 * The part of `view`'s visible window that lies on `refName`, or undefined
 * when the panel is not showing that contig — the case where there is no
 * window on this alignment's axis to map across.
 *
 * `dynamicBlocks` rather than `coarseDynamicBlocks`: this is read at the
 * moment of the click, so the debounced copy would answer with wherever the
 * panel was up to a tick ago.
 */
export function visibleSpanOnRefName(
  view: LinearGenomeViewModel,
  refName: string,
) {
  const blocks = view.dynamicBlocks.contentBlocks.filter(
    b => b.refName === refName,
  )
  return blocks.length
    ? {
        start: Math.min(...blocks.map(b => b.start)),
        end: Math.max(...blocks.map(b => b.end)),
      }
    : undefined
}
