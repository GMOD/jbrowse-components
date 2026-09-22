import { assembleLocString } from '@jbrowse/core/util'
import { isSameAssemblyName } from '@jbrowse/core/util/tracks'

import type { FollowAnchorHost } from '../SyntenyFollow/followHost.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { AssemblyNameResolver } from '@jbrowse/core/util/tracks'
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
 * TWO WAYS TO NAME THE ROWS. A ribbon click's widget reads its `level` off the
 * band its track sits in, so the rows are simply that pair. A band removed
 * since the click leaves no level, and the assemblies are the only thing left
 * to match on. It is NOT how a synteny track opened inside a panel arrives:
 * that widget's `view` is the panel's own LGV, which has no rows to index, and
 * it shows no centering link at all.
 *
 * A feature with no mate contributes one side rather than a second `navTo` on
 * `undefined`.
 *
 * The by-assembly path resolves both sides through the aliases. A feature's
 * `assemblyName` is the track's `assemblyNames` config text, and
 * `syntenyTrackRows` already resolves that through the aliases to decide the
 * track belongs on the level — so a track spelling an assembly differently from
 * the row it is drawn on is offered, and `===` then matched no row, reporting
 * both sides unfindable and centering nothing.
 */
export function syntenyCenterTargets({
  views,
  level,
  feat,
  assemblyManager,
}: {
  views: LinearGenomeViewModel[]
  level: number | undefined
  feat: SimpleFeatureSerialized
  assemblyManager: AssemblyNameResolver
}) {
  const loc = feat as NavLocation
  const mate = feat.mate as NavLocation | undefined
  const sides =
    level !== undefined
      ? [
          { loc, view: views[level] },
          { loc: mate, view: views[level + 1] },
        ]
      : [
          {
            loc,
            view: views.find(v =>
              isSameAssemblyName(
                v.assemblyNames[0],
                loc.assemblyName,
                assemblyManager,
              ),
            ),
          },
          {
            loc: mate,
            view: mate
              ? views.find(v =>
                  isSameAssemblyName(
                    v.assemblyNames[0],
                    mate.assemblyName,
                    assemblyManager,
                  ),
                )
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

/**
 * "Center view on this feature", from the feature panel and a ribbon's context
 * menu alike: both sides onto their rows, each attempted whichever fails, and
 * a message for every side that could not move. Held as one stack move, and
 * the follow anchor goes to the first row that moved — the feature's own,
 * unless its `navTo` threw — so the follow brings the rest of the stack to it
 * rather than pulling the moved rows back to an unmoved one.
 */
export function centerStackOnFeature({
  view,
  level,
  feat,
  assemblyManager,
}: {
  view: FollowAnchorHost & { views: LinearGenomeViewModel[] }
  level: number | undefined
  feat: SimpleFeatureSerialized
  assemblyManager: AssemblyNameResolver
}) {
  const { targets, missing } = syntenyCenterTargets({
    views: view.views,
    level,
    feat,
    assemblyManager,
  })
  const problems = [...missing]
  view.holdFollowAnchor(() => {
    let moved: LinearGenomeViewModel | undefined
    for (const { view: row, loc } of targets) {
      try {
        row.navTo(loc, 0.2)
        moved ??= row
      } catch (e) {
        problems.push(`${e}`)
      }
    }
    if (view.followSynteny && moved) {
      view.setFollowAnchorIndex(view.views.indexOf(moved))
    }
  })
  return problems
}
