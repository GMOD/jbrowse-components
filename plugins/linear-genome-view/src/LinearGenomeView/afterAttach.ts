import {
  getSession,
  isSessionModelWithWidgets,
  localStorageSetItem,
  resolveNamedRegions,
} from '@jbrowse/core/util'
import { coerceHighlight } from '@jbrowse/core/util/highlights'
import { installInitAutorun } from '@jbrowse/core/util/installInitAutorun'
import { normalizeTrackInit } from '@jbrowse/core/util/tracks'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun, when } from 'mobx'

import { SearchResultsNotFoundError } from '../searchUtils.ts'

import type { LinearGenomeViewModel } from './model.ts'
import type { InitState } from './types.ts'
import type { AssemblyHost, NotificationSink } from '@jbrowse/core/util'
import type { InitApplyContext } from '@jbrowse/core/util/installInitAutorun'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// `init` is a frozen blob that often comes from hand-authored JSON, where a
// lone entry gets written bare (`tracks: 'genes'`). A string is iterable, so
// looping over it directly walked its characters — one track opened per letter.
function asArray<T>(arg: T[] | T | undefined) {
  return arg === undefined ? [] : Array.isArray(arg) ? arg : [arg]
}

// Activate tracklist first so the drawer opens before we navigate, so
// volatileWidth accounts for the drawer; otherwise navigation computes the
// region at full width and the drawer then obscures part of it. Opening the
// drawer shrinks the view, which the ResizeObserver reports as a volatileWidth
// change — but only if the drawer wasn't already taking that width. So wait for
// the change only when activating it actually opens the column.
async function openTracklist(
  self: LinearGenomeViewModel,
  session: IStateTreeNode & NotificationSink,
  superseded: () => boolean,
) {
  // activateTrackSelector throws without widget support, which would abort the
  // rest of init (navigation included) over an optional extra
  if (isSessionModelWithWidgets(session)) {
    // `poppedOut` — the visible widget rendered in a modal, leaving the drawer
    // column free — lives on SessionWithDrawerWidgets, whose type guard is
    // product-core's, so duck-type it here rather than take an upward
    // dependency. A session without the key has no modal to pop out into, so
    // false is the right answer for it.
    const poppedOut = 'poppedOut' in session && session.poppedOut === true
    // the same line App.tsx draws to decide whether to render the drawer column
    // at all. A *minimized* drawer still holds a visibleWidget while taking no
    // width, and showWidget un-minimizes it (product-core's DrawerWidgets), so
    // `!!visibleWidget` alone reads "already open", skips the wait below, and
    // hands navigation the pre-drawer width — the exact thing this is here to
    // prevent.
    const drawerWasOpen =
      !!session.visibleWidget && !session.minimized && !poppedOut
    const widthBefore = self.volatileWidth
    self.activateTrackSelector()
    // a width change is only coming if the drawer is about to start taking
    // space; popped out it never does, so don't sit out the timeout for it
    if (!drawerWasOpen && !poppedOut) {
      // Bounded so init can't wedge here if the drawer doesn't shrink the view
      // (e.g. embedded or modal-drawer layouts, where no width change is
      // coming), and superseded so a re-launch landing mid-wait isn't held
      // behind an init that no longer matters
      await when(() => self.volatileWidth !== widthBefore || superseded(), {
        timeout: 1000,
      }).catch(() => {})
    }
  } else {
    session.notify(
      'init.tracklist was ignored: this application has no track selector drawer',
      'warning',
    )
  }
}

// Restrict a whole-genome view to a named subset of the assembly's regions, in
// the requested order. Entries may be globs (`*_hap1`) — see selectNamedRegions,
// shared with the dotplot's per-axis `displayedRegionNames` so both views read
// the same name list the same way.
function showNamedRegions(
  self: LinearGenomeViewModel,
  session: AssemblyHost & NotificationSink,
  assemblyName: string,
  names: string[],
) {
  const assembly = session.assemblyManager.get(assemblyName)
  const all = assembly?.regions
  if (all) {
    // resolveNamedRegions is what reports a list that matched nothing —
    // otherwise a typo'd refName silently shows the whole genome and reads as
    // displayedRegionNames being ignored. The FALLBACK stays here because it is
    // this view's alone: nothing shown yet means show the whole genome rather
    // than an empty view, but already navigated (URL params layered onto a
    // defaultSession) means keep what's there, since a typo shouldn't discard
    // the session's own navigation.
    const regions = resolveNamedRegions({
      regions: all,
      names,
      assemblyName,
      getCanonicalRefName: assembly.getCanonicalRefName2,
      allRefNames: assembly.allRefNames,
      notify: message => {
        session.notify(message, 'warning')
      },
    })
    if (regions) {
      // showRegions, not showAllRegionsInAssembly: `displayedRegionNames` is
      // the spec naming what it wants shown, so it gets the width
      self.showRegions(regions)
    } else if (!self.hasDisplayedRegions) {
      // The fallback IS "show me everything", so it keeps the margin.
      self.showAllRegionsInAssembly(assemblyName)
    }
  }
}

async function navigateInit(
  self: LinearGenomeViewModel,
  session: AssemblyHost & NotificationSink,
  init: InitState,
) {
  try {
    if (init.loc) {
      // navToLocString waits for the assembly itself, and this autorun only
      // runs once `initialized` confirms init.assembly has loaded regions, so
      // no explicit waitForAssembly is needed here
      await self.navToLocString(init.loc, init.assembly, init.grow)
    } else if (init.displayedRegionNames?.length) {
      // an explicit region list is a navigation request just like `loc`, so it
      // applies even when regions already exist (URL params layered onto a
      // defaultSession that already navigated)
      //
      // `?.length`, not the bare key: an empty array is truthy, so a spec
      // writing `displayedRegionNames: []` took this path with nothing to name
      // and got told its list of no names had matched no regions. That is why
      // LinearSyntenyView's doSubmit omits the key rather than passing [].
      showNamedRegions(self, session, init.assembly, init.displayedRegionNames)
    } else if (!self.hasDisplayedRegions) {
      // a highlight-only init (nothing to navigate to) must not clobber a
      // defaultSession's existing navigation, so only auto-navigate when
      // nothing is shown yet
      self.showAllRegionsInAssembly(init.assembly)
    }
  } catch (e) {
    console.error(init, e)
    if (e instanceof SearchResultsNotFoundError) {
      // a &loc= gene name that matched nothing is a soft miss, not an app error
      session.notify(e.message, 'warning')
    } else {
      session.notifyError(`${e}`, e)
    }
  }
}

// showTrack funnels through showTrackGeneric, which surfaces any failure
// (unresolved id, bad config, etc) as its own snackbar
function showInitTracks(self: LinearGenomeViewModel, init: InitState) {
  for (const t of asArray(init.tracks)) {
    const { trackId, trackSnapshot, displaySnapshot } = normalizeTrackInit(t)
    self.showTrack(trackId, trackSnapshot, displaySnapshot)
  }
}

// backfill assemblyName on any session-authored highlights that omitted it so
// downstream code (bookmark widget grid, addBookmark, etc) doesn't have to keep
// falling back
function backfillHighlightAssemblies(self: LinearGenomeViewModel) {
  const fallback = self.assemblyNames[0]
  if (self.highlight.length && fallback) {
    const normalized = self.highlight.map(h =>
      h.assemblyName ? h : { ...h, assemblyName: fallback },
    )
    if (normalized.some((h, i) => h !== self.highlight[i])) {
      self.setHighlight(normalized)
    }
  }
}

/**
 * Apply an init blob's `highlight` entries to a view, coercing each locstring
 * or wire-format object and reporting a bad one without taking out its
 * siblings.
 *
 * Exported because a LinearSyntenyView row is a LinearGenomeView that does NOT
 * go through this file's init autorun — the synteny view builds each row's
 * snapshot and navigates it itself — so the row's own `highlight` had nowhere
 * to be applied and was dropped in silence.
 */
export function applyInitHighlights(
  self: LinearGenomeViewModel,
  session: AssemblyHost & NotificationSink,
  init: Pick<InitState, 'highlight' | 'assembly'>,
) {
  for (const h of asArray(init.highlight)) {
    // parseLocString throws on an unknown refName or a malformed locstring, and
    // one bad entry must take out neither its siblings nor the rest of init
    try {
      const highlight = coerceHighlight(h, init.assembly, refName =>
        session.assemblyManager.isValidRefName(refName, init.assembly),
      )
      if (highlight) {
        self.addToHighlights(highlight)
      }
    } catch (e) {
      console.error(e)
      session.notifyError(
        `Invalid init highlight ${JSON.stringify(h)}: ${e}`,
        e,
      )
    }
  }
}

async function applyInit(
  self: LinearGenomeViewModel,
  init: InitState,
  { superseded }: InitApplyContext,
) {
  const session = getSession(self)
  if (init.tracklist) {
    await openTracklist(self, session, superseded)
  }
  // `superseded`, not a bare isAlive: it subsumes the liveness check (the view
  // may have been removed while the drawer or the navigation resolved, and
  // reading or mutating a detached node throws) and also covers the case
  // isAlive misses — a newer setInit landed mid-apply, so the rest of *this*
  // blob is stale. Finishing it anyway appends its tracks and highlights under
  // the one that replaced it, and addToHighlights pushes, so a re-launch of the
  // same spec (a StrictMode remount) doubles the bands. The drain loop applies
  // the newer init next either way.
  //
  // Checked after each await rather than once at the top, and as early returns
  // rather than nesting, so a step added later takes a guard beside it instead
  // of another level of indent.
  if (superseded()) {
    return
  }
  await navigateInit(self, session, init)
  if (superseded()) {
    return
  }
  showInitTracks(self, init)
  if (init.nav !== undefined) {
    self.setHideHeader(!init.nav)
  }
  backfillHighlightAssemblies(self)
  applyInitHighlights(self, session, init)
}

/**
 * Autorun that handles the init state - navigating to initial location,
 * showing tracks, etc.
 */
export function setupInitAutorun(self: LinearGenomeViewModel) {
  installInitAutorun(self, {
    name: 'LGVInit',
    // `init` is what makes hasSomethingToShow / awaitingInitNavigation report
    // "loading"
    // until navigation populates displayedRegions, so the alternative gate
    // (clearing `init` up front, the way SpreadsheetView does) would flash the
    // import form mid-load.
    ready: () => self.initialized,
    // No pre-materialization phase to protect: the view is its own single row,
    // and `error` already derives a failed init assembly declaratively (via
    // initAssembly), so anything thrown out of applyInit is a failure of a
    // step, not of the view coming up.
    materialized: () => true,
    apply: (init, ctx) => applyInit(self, init, ctx),
  })
}

/**
 * Autorun that updates coarse dynamic blocks with a delay
 */
function setupCoarseDynamicBlocksAutorun(self: LinearGenomeViewModel) {
  addDisposer(
    self,
    autorun(
      function coarseDynamicBlocksAutorun() {
        if (self.initialized) {
          self.setCoarseDynamicBlocks(self.dynamicBlocks, self.bpPerPx)
        }
      },
      {
        delay: 500,
        name: 'LGVCoarseDynamicBlocks',
      },
    ),
  )
}

/**
 * Autorun that syncs view settings to localStorage
 */
function setupLocalStorageAutorun(self: LinearGenomeViewModel) {
  addDisposer(
    self,
    autorun(
      function localStorageAutorun() {
        const s = (s: unknown) => JSON.stringify(s)
        const {
          showCytobands,
          showCenterLine,
          colorByCDS,
          showAminoAcids,
          showTrackOutlines,
          trackLabels,
        } = self
        localStorageSetItem('lgv-showCytobands', s(showCytobands))
        localStorageSetItem('lgv-showCenterLine', s(showCenterLine))
        localStorageSetItem('lgv-colorByCDS', s(colorByCDS))
        localStorageSetItem('lgv-showAminoAcids', s(showAminoAcids))
        localStorageSetItem('lgv-showTrackOutlines', s(showTrackOutlines))
        // skip writing the empty default — otherwise reads later round-trip to
        // '' instead of null, hiding the config-fallback path
        if (trackLabels) {
          localStorageSetItem('lgv-trackLabels', trackLabels)
        }
      },
      {
        name: 'LGVLocalStorage',
      },
    ),
  )
}

/**
 * Sets up all afterAttach autoruns for the LinearGenomeView
 */
export function doAfterAttach(self: LinearGenomeViewModel) {
  setupInitAutorun(self)
  setupCoarseDynamicBlocksAutorun(self)
  setupLocalStorageAutorun(self)
}
