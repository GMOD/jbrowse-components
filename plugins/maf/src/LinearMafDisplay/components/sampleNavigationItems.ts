import { isSameAssemblyName, openMateLabel } from '@jbrowse/core/util/tracks'

import { launchMafRowSynteny } from '../launchMafRowSynteny.ts'
import {
  navigationLocString,
  openSampleInNewView,
} from '../openSampleInNewView.ts'
import { selectionRegion } from '../openSubsequenceWidget.ts'
import { mafPointerAt, rowSpanAtY } from './mafHitTest.ts'

import type {
  MafSyntenyHost,
  MafSyntenyLaunchModel,
} from '../launchMafRowSynteny.ts'
import type { SampleNavigationTarget } from '../openSampleInNewView.ts'
import type { MafHitTestModel } from './mafHitTest.ts'
import type { ContextCoord } from './useDragSelection.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type {
  AbstractViewContainer,
  AssemblyHost,
  NotificationSink,
  TrackCatalog,
} from '@jbrowse/core/util'
import type { AssemblyNameResolver } from '@jbrowse/core/util/tracks'

/** What screening the reference's own rows out needs of the session. */
export interface RowTargetHost {
  assemblyManager: AssemblyNameResolver
}

/**
 * The display slice these items read — the hit-test geometry plus the row
 * lookup and the id the launched view is keyed on. Structural for the same
 * reason `MafHitTestModel` is: it keeps this a plain function, testable with a
 * literal instead of a live MST tree.
 */
export type SampleNavigationModel = MafHitTestModel & {
  id: string
  rowNavigationTargets: (
    displayedRegionIndex: number,
    startBp: number,
    endBp: number,
    startRow: number,
    endRow: number,
  ) => (SampleNavigationTarget & { rowIndex: number })[]
  view: { assemblyNames: string[] }
}

/** Above this many navigable rows the entries move into a submenu. */
const MAX_INLINE_ITEMS = 6

/**
 * The rows a drag selection covers that lead somewhere: each with the sample's
 * own locus under the selection, plus the selection itself in reference terms,
 * which the synteny launch reads the blocks back out of.
 *
 * The region is taken at the selection's start pixel, and the span is
 * `selectionRegion`'s: on a multi-region view a selection crossing a region
 * boundary clips to the region it began in, so the widget and these entries
 * name the same bases.
 */
export function selectedRowTargets(
  session: RowTargetHost,
  model: SampleNavigationModel,
  contextCoord: ContextCoord,
) {
  const { startX, endX, startY, endY } = contextCoord
  return rowTargetsBetween(session, model, {
    leftPx: Math.min(startX, endX),
    rightPx: Math.max(startX, endX),
    leftY: startY,
    rightY: endY,
    ...rowSpanAtY(model, startY, endY),
  })
}

/** The rows a span leads to, and the reference span itself. */
export type RowTargets = ReturnType<typeof selectedRowTargets>

/**
 * The same list over the whole window and every row, which is what the track
 * menu offers: a reader who has not drawn a selection has still chosen a locus,
 * by navigating to it.
 */
export function visibleRowTargets(
  session: RowTargetHost,
  model: SampleNavigationModel & {
    sources: unknown[]
    view: { width: number }
  },
) {
  return rowTargetsBetween(session, model, {
    leftPx: 0,
    rightPx: model.view.width - 1,
    startRow: 0,
    endRow: model.sources.length,
  })
}

/** What both of the above are: a bp span from two pixels, over a row range. */
function rowTargetsBetween(
  { assemblyManager }: RowTargetHost,
  model: SampleNavigationModel,
  {
    leftPx,
    rightPx,
    leftY = 0,
    rightY = 0,
    startRow,
    endRow,
  }: {
    leftPx: number
    rightPx: number
    leftY?: number
    rightY?: number
    startRow: number
    endRow: number
  },
) {
  const left = mafPointerAt(model, leftPx, leftY)
  const right = mafPointerAt(model, rightPx, rightY)
  // Literally `selectionRegion`, not a second span computed the same way: it
  // orders the two edges on a reversed region and clips the right one into the
  // left's region, and this had only the first half — so on a multi-region view
  // every Launch entry named a span whose end was another chromosome's
  // coordinate. `visibleRowTargets` takes px 0 and width-1, which is that case
  // on every multi-region view.
  const {
    refName,
    start: startBp,
    end: endBp,
  } = selectionRegion(left.pos, right.pos)
  // The reference's own row leads nowhere this view is not already: a pangenome
  // MAF carries the reference as a sample, and with its assembly loaded under
  // that name the row resolves like any other. Compared through the assembly
  // manager, since the view and the sample can spell one assembly two ways.
  const targets = model
    .rowNavigationTargets(left.pos.index, startBp, endBp, startRow, endRow)
    .filter(
      t =>
        !model.view.assemblyNames.some(a =>
          isSameAssemblyName(a, t.assemblyName, assemblyManager),
        ),
    )
  return {
    regionIndex: left.pos.index,
    refName,
    startBp,
    endBp,
    targets,
  }
}

/**
 * "Open this species' own genome here" entries for the rows a drag selection
 * covers. A row contributes an entry only when its sample carries an
 * `assemblyName` (so there is a genome to navigate to) and it has aligned bases
 * in the selection — the menu is built from the data rather than listing dead
 * rows for every sample.
 */
export function sampleNavigationItems(
  session: AbstractViewContainer &
    AssemblyHost &
    TrackCatalog &
    NotificationSink,
  model: Pick<SampleNavigationModel, 'id'>,
  { targets }: RowTargets,
): MenuItem[] {
  function menuItem(target: SampleNavigationTarget, label: string) {
    return {
      label,
      onClick: () => {
        openSampleInNewView(session, model.id, target).catch((e: unknown) => {
          session.notifyError(`${e}`, e)
        })
      },
    }
  }

  return targets.length === 0
    ? []
    : targets.length <= MAX_INLINE_ITEMS
      ? targets.map(t => menuItem(t, openMateLabel(t.sampleLabel)))
      : [
          {
            label: 'Open aligned genome at the matching region',
            subMenu: targets.map(t =>
              menuItem(t, `${t.sampleLabel} ${navigationLocString(t)}`),
            ),
          },
        ]
}

/**
 * The comparison, beside the jump above: the reference against one aligned
 * sample as a two-row synteny view over the selection, ribbons cut from the
 * MAF columns. One submenu whatever the row count — the per-row jump entries
 * already fill the menu, and this is the same list read a second way.
 */
export function mafSyntenyLaunchItems(
  session: MafSyntenyHost & NotificationSink,
  model: MafSyntenyLaunchModel,
  { targets, regionIndex, refName, startBp, endBp }: RowTargets,
): MenuItem[] {
  const refAssembly = model.view.assemblyNames[0]
  return targets.length === 0 || refAssembly === undefined
    ? []
    : [
        {
          label: `Linear synteny view, ${refAssembly} vs...`,
          subMenu: targets.map(target => ({
            label: `${target.sampleLabel} ${navigationLocString(target)}`,
            onClick: () => {
              launchMafRowSynteny({
                host: session,
                model,
                target,
                regionIndex,
                refName,
                startBp,
                endBp,
              }).catch((e: unknown) => {
                session.notifyError(`${e}`, e)
              })
            },
          })),
        },
      ]
}
