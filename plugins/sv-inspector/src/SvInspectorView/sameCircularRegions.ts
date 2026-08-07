import type { Region } from '@jbrowse/core/util'

/**
 * Whether two region lists describe the same circle.
 *
 * `setDisplayedRegions` re-fits the figure and clears `autoFit`, so the SV
 * inspector's region binding only writes when this says the list really
 * changed. Otherwise every grid keystroke recomputes the relevant-refName set
 * and throws away the user's pan and zoom.
 *
 * Coordinates and assemblyName are part of the comparison, not just refName: two
 * assemblies can carry the same refName list in the same order while every
 * contig has a different length (T2T-CHM13 and a primary-only GRCh38 are both
 * chr1..chr22,chrX,chrY,chrM). A refName-only check calls that pair equal, so
 * reloading the sheet from one onto the other left the circle drawn against the
 * previous assembly's coordinates.
 */
export function sameCircularRegions(a: Region[], b: Region[]) {
  return (
    a.length === b.length &&
    a.every((r, i) => {
      const o = b[i]!
      return (
        r.refName === o.refName &&
        r.start === o.start &&
        r.end === o.end &&
        r.assemblyName === o.assemblyName
      )
    })
  )
}
