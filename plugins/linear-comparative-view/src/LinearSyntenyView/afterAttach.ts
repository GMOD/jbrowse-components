import {
  getNotificationSink,
  getSession,
  resolveNamedRegions,
} from '@jbrowse/core/util'
import { installInitAutorun } from '@jbrowse/core/util/installInitAutorun'
import { getEnv, isAlive } from '@jbrowse/mobx-state-tree'
import {
  applyInitHighlights,
  linearGenomeViewPropKeys,
  normalizeTrackInit,
  partitionLaunchKeys,
  SearchResultsNotFoundError,
} from '@jbrowse/plugin-linear-genome-view'
import { withDiagonalizeProgress } from '@jbrowse/synteny-core'
import { when } from 'mobx'

import { installAutoFadeLatch } from './installAutoFadeLatch.ts'
import { normalizeTrackLevels } from './util/initHelpers.ts'

import type { LinearSyntenyViewModel } from './model.ts'
import type { LinearSyntenyViewCommands } from './types.ts'
import type { InitApplyContext } from '@jbrowse/core/util/installInitAutorun'
import type { Region } from '@jbrowse/core/util/types'
import type { LaunchInput } from '@jbrowse/core/util/withLaunchInput'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The launch blob as the steps below work with it: `views` defaulted, since a
// spec naming only a setting partitions into a blob with no rows at all and
// that is the import form rather than a case to guard at each read.
type SyntenyLaunch = LaunchInput<LinearSyntenyViewCommands> & {
  views: NonNullable<LinearSyntenyViewCommands['views']>
}

// The regions one genome row opens on: its assembly's whole set, or the subset
// `displayedRegionNames` picks out. Resolved here rather than left to the row's
// own LGV init because the row is built from a snapshot — `displayedRegions` is
// a prop of that snapshot, and a second pass that rewrote it afterwards would
// be a visible reflow through the whole-genome state on every launch.
function rowRegions(
  asm: {
    regions?: Region[]
    allRefNames?: string[]
    getCanonicalRefName2: (n: string) => string
  },
  assemblyName: string,
  names: string[] | undefined,
  notify: (message: string) => void,
) {
  const all = asm.regions ?? []
  if (!names?.length) {
    return all
  }
  // falling back to the whole assembly is the right shape — an empty LGV renders
  // as a broken panel — but doing it in silence is not, and this row used to.
  // The form's chromosome box makes a typo something a user does rather than
  // something a spec author does.
  return (
    resolveNamedRegions({
      regions: all,
      names,
      assemblyName,
      getCanonicalRefName: asm.getCanonicalRefName2,
      allRefNames: asm.allRefNames,
      notify,
    }) ?? all
  )
}

// One genome row per init.views entry, each opened on its assembly's whole
// region set. Awaits every assembly first so a failure surfaces before any view
// is built — that ordering is what makes this the view's only fatal step, and
// what lets the catch below keep `init` for a retry.
async function buildViews(
  self: LinearSyntenyViewModel,
  init: SyntenyLaunch,
  superseded: () => boolean,
) {
  const session = getSession(self)
  const { assemblyManager } = session
  // The LGV's declared property names, so a row can carry any of them. Read
  // from the registered view type rather than a list here: the rows do not
  // exist yet, and a second list is what went stale last time.
  const rowPropKeys = linearGenomeViewPropKeys(getEnv(self).pluginManager)
  const assemblies = await Promise.all(
    init.views.map(async v => {
      const asm = await assemblyManager.waitForAssembly(v.assembly)
      if (!asm) {
        throw new Error(`Assembly ${v.assembly} failed to load`)
      }
      return asm
    }),
  )
  self.setViews(
    assemblies.map((asm, idx) => {
      // `assemblies` IS init.views mapped, so the pairing is total and the
      // three optional chains this used to carry described a case that cannot
      // arise
      const v = init.views[idx]!
      return {
        type: 'LinearGenomeView' as const,
        hideHeader: true,
        // A row init gives no tracks opens collapsed to its ruler when asked
        // for (the launch dialog's checkbox), never by default: an authored
        // session means what it wrote. Only the row's own emptiness is decided
        // here — the policy is the caller's.
        scalebarOnly: !!init.collapseEmptyRows && !v.tracks?.length,
        // The row's own subset, or the whole genome. A name list that resolves
        // to nothing falls back rather than blanking the row: an empty LGV
        // renders as a broken panel, the same choice the circular view makes.
        displayedRegions: rowRegions(
          asm,
          v.assembly,
          v.displayedRegionNames,
          message => {
            session.notify(message, 'warning')
          },
        ),
        // Plain persisted LGV props (trackLabels, showAminoAcids, colorByCDS, …)
        // go straight onto the row's snapshot, where MST restores them natively.
        // Partitioned rather than listed, so a prop the LGV gains is a prop a
        // synteny row can set, with no second list to keep in step.
        ...partitionLaunchKeys(v, rowPropKeys).viewProps,
      }
    }),
  )
  // a row only initializes once it has been laid out, so this parks
  // indefinitely if the view is never given a width — which would hold the
  // drain open and strand the newer init that replaced this one
  await when(() => superseded() || self.views.every(view => view.initialized))
}

// Navigate one genome row, reporting a bad `loc` as that row's problem. Without
// this catch a single typo'd locstring rejects the whole Promise.all below, and
// the outer catch drops every row that loaded fine back to the import form —
// navToLocString throws both UnknownRefNameError (bad refName) and
// SearchResultsNotFoundError (a gene name that matched nothing).
async function navRowToLoc(
  self: LinearSyntenyViewModel,
  view: LinearGenomeViewModel,
  loc: string,
  assembly: string,
) {
  try {
    await view.navToLocString(loc, assembly)
  } catch (e) {
    console.error(e)
    const session = getSession(self)
    if (e instanceof SearchResultsNotFoundError) {
      // a gene name that matched nothing is a soft miss, not an app error
      session.notify(e.message, 'warning')
    } else {
      session.notifyError(`${e}`, e)
    }
  }
}

// Per-row location + track list. Rows are independent, so they navigate
// concurrently.
async function applyInitViewLocsAndTracks(
  self: LinearSyntenyViewModel,
  init: SyntenyLaunch,
) {
  await Promise.all(
    init.views.map(async (viewInit, idx) => {
      const view = self.views[idx]
      if (view) {
        if (viewInit.loc) {
          await navRowToLoc(self, view, viewInit.loc, viewInit.assembly)
        } else if (viewInit.displayedRegionNames?.length) {
          // Fit to what the row DISPLAYS, not to the assembly.
          // showAllRegionsInAssembly re-reads the assembly's own region list and
          // writes it over displayedRegions, which would throw away the subset
          // buildViews just installed — the restriction would apply for one
          // frame and then silently undo itself.
          //
          // And fit rather than showAllRegions, which this said it did and did
          // not: the latter targets maxBpPerPx, so a restricted row drew at
          // 1/SHOW_ALL_REGIONS_FILL of its width with the content centered.
          // Stacked against a row that named a locus, that is a scale
          // difference between the two halves of the comparison.
          view.fitAllRegions()
        } else {
          view.showAllRegionsInAssembly(viewInit.assembly)
        }
        if (viewInit.tracks) {
          for (const track of viewInit.tracks) {
            const { trackId, trackSnapshot, displaySnapshot } =
              normalizeTrackInit(track)
            await view.launchTrack(trackId, trackSnapshot, displaySnapshot)
          }
        }
        // AFTER navigation, and applied here rather than by the row's own LGV
        // init: a row is built from a snapshot and navigated by this file, so
        // nothing on the row ever runs `applyInit` and every init key that is
        // not `loc`, `tracks` or `displayedRegionNames` had nowhere to land.
        // `highlight` is the one a spec actually reaches for -- marking the
        // same span on two rows is how a synteny figure says "this object,
        // seen twice" -- and it was being dropped in silence, which is the
        // failure mode `partitionLaunchKeys` exists to end everywhere else.
        applyInitHighlights(view, getSession(self), {
          highlight: viewInit.highlight,
          assembly: viewInit.assembly,
        })
      }
    }),
  )
}

// The synteny tracks themselves: `init.tracks` is per level (the gap between
// views[i] and views[i+1]), so a 3-way view has two entries.
async function applyInitSyntenyTracks(
  self: LinearSyntenyViewModel,
  init: SyntenyLaunch,
) {
  if (init.tracks) {
    for (const [i, entries] of normalizeTrackLevels(init.tracks).entries()) {
      for (const entry of entries) {
        if (typeof entry === 'string') {
          await self.launchTrack(entry, i)
        } else {
          await self.launchTrack(entry.trackId, i, {}, {}, entry)
        }
      }
    }
  }
}

// The views are initialized and their displayedRegions populated by the time
// this runs, and runDiagonalize fetches the whole-genome alignments it needs in
// its own RPC — so we diagonalize directly, no need to wait on the per-display
// render fetch first. withDiagonalizeProgress drives the reordering spinner +
// cancel and swallows the abort.
async function runAutoDiagonalize(self: LinearSyntenyViewModel) {
  await withDiagonalizeProgress(self, async opts => {
    const { runDiagonalize } = await import('./util/runDiagonalize.ts')
    await runDiagonalize(self, opts)
    // only now is the view truly diagonalized — release the `settled` gate. If
    // runDiagonalize threw, withDiagonalizeProgress catches it and this line is
    // skipped, so `settled` stays false and the capture times out loudly instead
    // of committing an undiagonalized view.
    if (isAlive(self)) {
      self.finishAutoDiagonalize()
    }
  })
}

// The launch keys whose destination is neither the view's own state nor a row:
// `levelHeights` lands after the auto-scale pass it is allowed to override, and
// the two ribbon settings are promotable config slots on every synteny display
// this launch opened, so applying them is a fan-out write.
function applyLaunchSettings(
  self: LinearSyntenyViewModel,
  init: SyntenyLaunch,
) {
  if (init.levelHeights) {
    for (const [i, h] of init.levelHeights.entries()) {
      self.levels[i]?.setHeight(h)
    }
  }
  if (init.drawCurves !== undefined) {
    self.setDrawCurves(init.drawCurves)
  }
  if (init.drawLocationMarkers !== undefined) {
    self.setDrawLocationMarkers(init.drawLocationMarkers)
  }
}

async function applyInit(
  self: LinearSyntenyViewModel,
  blob: LaunchInput<LinearSyntenyViewCommands>,
  { superseded }: InitApplyContext,
) {
  const init: SyntenyLaunch = { ...blob, views: blob.views ?? [] }
  // Naming no assembly means "open a synteny view and let me choose", which is
  // the only route to the import form from a session spec: a launch has to pass
  // two rows to clear launchSyntenyView's `< 2` guard, and two EMPTY rows used
  // to reach `waitForAssembly` with no name and throw across the form. Naming
  // some but not all is malformed spec data, so say so rather than half-launch.
  // Both consume the init: neither could succeed on a retry. DotplotView's
  // applyInit states the same rule.
  const named = init.views.filter(v => v.assembly)
  if (named.length === 0) {
    return
  }
  if (named.length < init.views.length) {
    getNotificationSink(self).notifyError(
      'LinearSyntenyView init needs an assembly on every one of its views',
    )
    return
  }
  // declare the reorder gate up front, before any track render can paint: it
  // outlives this pass (only the reorder itself lowers it) where the levels'
  // `initPending` term covers only the apply window below
  self.beginAutoDiagonalize(!!init.autoDiagonalize)
  await buildViews(self, init, superseded)
  await applyInitViewLocsAndTracks(self, init)
  await applyInitSyntenyTracks(self, init)
  // split the band budget across however many levels this view has, so a
  // multi-way stack doesn't spend the whole viewport on ribbons. A no-op at two
  // levels (a pairwise view keeps the 100px default), and applyLaunchSettings
  // runs after, so an explicit `levelHeights` wins.
  self.autoScaleLevelHeights()
  applyLaunchSettings(self, init)
  if (init.autoDiagonalize) {
    await runAutoDiagonalize(self)
  }
  // The replay step, last as it always was: after the diagonalize, which
  // rewrites a reordered row's displayedRegions and re-centers it. The PROPERTY
  // is what is read — `sameScale` already landed on it, however it was
  // spelled — and what a launch adds is the zoom the write alone does not do.
  // A plain session restore runs none of this, and its rows keep the scale they
  // were saved at.
  if (self.sameScale) {
    // the ceiling, not the regions: the rows were just placed by
    // `views[].loc` above, and "show all regions" would throw those away
    self.applySharedScale()
  }
}

export function doAfterAttach(self: LinearSyntenyViewModel) {
  // Serializing the firings is what makes this safe under a workspace tab being
  // shown + React Strict Mode double-invoke, which settle width in steps:
  // without it a second run's setViews() detaches the first run's view models,
  // and the first's `when(() => view.initialized)` then throws on the dead node
  // and gets reported as a view error.
  installInitAutorun(self, {
    name: 'LinearSyntenyViewInit',
    ready: () => !!self.width,
    // buildViews awaits every assembly before it calls setViews, so rows exist
    // only once the view is genuinely up. That makes it the fatal step: a
    // failure before it (assembly missing, network blip) leaves nothing on
    // screen and keeps `init` for a reload retry, while anything after is one
    // sub-step's problem and must not discard the rows that loaded fine.
    materialized: () => self.views.length > 0,
    apply: (init, ctx) => applyInit(self, init, ctx),
  })
  installAutoFadeLatch(self)
}
