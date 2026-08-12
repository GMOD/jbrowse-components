import { assembleLocString } from '@jbrowse/core/util'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type {
  LinearGenomeViewModel,
  NavLocation,
} from '@jbrowse/plugin-linear-genome-view'

export interface CenterTarget {
  view: LinearGenomeViewModel
  loc: NavLocation
}

/**
 * The rows "Center view on this feature" moves, and a message for every side it
 * could not name one for.
 *
 * Resolved BEFORE anything navigates, because the two sides fail independently
 * and the caller has to be able to report that: a row can be missing here, and
 * `navTo` itself throws for a row whose displayed regions do not contain the
 * feature (a panel the user has since sent to another contig, which is an
 * ordinary thing to have done while this widget sat open in the drawer). One of
 * those throwing used to abort the click, leaving the other row moved or not
 * moved depending on which side went first, and the error uncaught.
 *
 * TWO WAYS TO NAME THE ROWS. A ribbon click stores the `level` the band was
 * drawn on, so the rows are simply that pair. Without one there is nothing
 * saying which pair a feature belongs to, and the assemblies are the only thing
 * left to match on — reachable because `level` is optional on the widget model,
 * so a restored session from before that property, or any later opener that
 * cannot name a row, arrives here. It is NOT how a synteny track opened inside
 * a panel arrives: that widget's `view` is the panel's own LGV, which has no
 * rows to index, and it shows no centering link at all.
 *
 * A feature with no mate contributes one side rather than a second `navTo` on
 * `undefined`.
 */
export function syntenyCenterTargets({
  views,
  level,
  feat,
}: {
  views: LinearGenomeViewModel[]
  level: number | undefined
  feat: SimpleFeatureSerialized
}) {
  const mate = feat.mate as NavLocation | undefined
  const sides =
    level !== undefined
      ? [
          { loc: feat as NavLocation, view: views[level] },
          { loc: mate, view: views[level + 1] },
        ]
      : [
          {
            loc: feat as NavLocation,
            view: views.find(v => v.assemblyNames[0] === feat.assemblyName),
          },
          {
            loc: mate,
            view: mate
              ? views.find(v => v.assemblyNames[0] === mate.assemblyName)
              : undefined,
          },
        ]
  const targets: CenterTarget[] = []
  const missing: string[] = []
  for (const { loc, view } of sides) {
    if (!loc) {
      continue
    }
    if (view) {
      targets.push({ view, loc })
    } else {
      missing.push(`Unable to find ${assembleLocString(loc)} in synteny view`)
    }
  }
  return { targets, missing }
}
