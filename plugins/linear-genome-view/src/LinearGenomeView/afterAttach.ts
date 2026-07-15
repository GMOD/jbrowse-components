import {
  getSession,
  isSessionModelWithWidgets,
  localStorageSetItem,
  parseLocString,
} from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, when } from 'mobx'

import { SearchResultsNotFoundError } from '../searchUtils.ts'
import { normalizeTrackInit } from './normalizeTrackInit.ts'

import type { LinearGenomeViewModel } from './model.ts'
import type { HighlightType, InitState } from './types.ts'
import type { AbstractSessionModel, Region } from '@jbrowse/core/util'

// Derived from InitState so the two can't drift: the Record requires exactly
// one entry per InitState key, so adding/removing a field without updating
// here is a compile error rather than a key that silently warns as "unknown".
const knownInitKeyMap: Record<keyof InitState, true> = {
  loc: true,
  assembly: true,
  displayedRegionNames: true,
  tracks: true,
  tracklist: true,
  nav: true,
  highlight: true,
}
export const knownInitKeys = new Set(Object.keys(knownInitKeyMap))

function tryParseJson(s: string): Record<string, unknown> | undefined {
  try {
    const v: unknown = JSON.parse(s)
    return v && typeof v === 'object'
      ? (v as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

// a declarative init is easy to typo (e.g. `tracksList`, `highlights`); MST
// stores it as a frozen blob so a mistyped key would otherwise be silently
// dropped with no diagnostic
function warnUnknownInitKeys(init: InitState) {
  const unknown = Object.keys(init).filter(k => !knownInitKeys.has(k))
  if (unknown.length) {
    console.warn(
      `LinearGenomeView init ignored unknown key(s): ${unknown.join(', ')}`,
    )
  }
}

// Activate tracklist first so the drawer opens before we navigate, so
// volatileWidth accounts for the drawer; otherwise navigation computes the
// region at full width and the drawer then obscures part of it. Opening the
// drawer shrinks the view, which the ResizeObserver reports as a volatileWidth
// change — but only if the drawer wasn't already open. So wait for the change
// (no timeout) only when we actually opened it; if a widget was already
// visible, the width is already correct and no change is coming.
async function openTracklist(
  self: LinearGenomeViewModel,
  session: AbstractSessionModel,
) {
  const drawerWasOpen =
    isSessionModelWithWidgets(session) && !!session.visibleWidget
  const widthBefore = self.volatileWidth
  self.activateTrackSelector()
  if (!drawerWasOpen) {
    await when(() => self.volatileWidth !== widthBefore)
  }
}

// Restrict a whole-genome view to a named subset of the assembly's regions, in
// the requested order. Selects from the assembly's own (canonical) regions so
// coordinates/lengths are correct; names resolve through the assembly aliases.
function showNamedRegions(
  self: LinearGenomeViewModel,
  session: AbstractSessionModel,
  assemblyName: string,
  names: string[],
) {
  const assembly = session.assemblyManager.get(assemblyName)
  const all = assembly?.regions
  if (all) {
    const byRefName = new Map(all.map(r => [r.refName, r]))
    const regions = names
      .map(n => byRefName.get(assembly.getCanonicalRefName(n) ?? n))
      .filter((r): r is Region => r !== undefined)
    if (regions.length) {
      self.setDisplayedRegions(regions)
      self.showAllRegions()
    }
  }
}

async function navigateInit(
  self: LinearGenomeViewModel,
  session: AbstractSessionModel,
  init: InitState,
) {
  try {
    if (init.loc) {
      // navToLocString waits for the assembly itself, and this autorun only
      // runs once `initialized` confirms init.assembly has loaded regions, so
      // no explicit waitForAssembly is needed here
      await self.navToLocString(init.loc, init.assembly)
    } else if (!self.hasDisplayedRegions) {
      // a highlight-only init (no loc) must not clobber a defaultSession's
      // existing navigation, so only auto-navigate when nothing is shown yet
      if (init.displayedRegionNames) {
        showNamedRegions(
          self,
          session,
          init.assembly,
          init.displayedRegionNames,
        )
      } else {
        self.showAllRegionsInAssembly(init.assembly)
      }
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
  for (const t of init.tracks ?? []) {
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

// a string is either a loc string ("chr1:100-200") or a JSON-encoded
// HighlightType (the URL wire-format, since URL params can't carry objects).
// note: the jbrowse-web &highlight= URL param is space-split, so the JSON-string
// form only survives when it contains no spaces; a label with a space is
// shattered by the split — pass a HighlightType object instead
function parseJsonHighlight(
  s: string,
  defaultAssembly: string,
): HighlightType | undefined {
  const json = s.trimStart().startsWith('{') ? tryParseJson(s) : undefined
  return json &&
    typeof json.refName === 'string' &&
    typeof json.start === 'number' &&
    typeof json.end === 'number'
    ? {
        refName: json.refName,
        start: json.start,
        end: json.end,
        assemblyName:
          typeof json.assemblyName === 'string'
            ? json.assemblyName
            : defaultAssembly,
        color: typeof json.color === 'string' ? json.color : undefined,
        label: typeof json.label === 'string' ? json.label : undefined,
      }
    : undefined
}

function parseLocHighlight(
  s: string,
  defaultAssembly: string,
  isValidRefName: (refName: string) => boolean,
): HighlightType | undefined {
  const { refName, start, end } = parseLocString(s, isValidRefName)
  return start !== undefined && end !== undefined
    ? { refName, start, end, assemblyName: defaultAssembly }
    : undefined
}

// normalize an init.highlight entry (HighlightType object, JSON string, or loc
// string) into a HighlightType, defaulting the assemblyName
function coerceHighlight(
  h: string | HighlightType,
  defaultAssembly: string,
  isValidRefName: (refName: string) => boolean,
): HighlightType | undefined {
  return typeof h === 'object'
    ? { ...h, assemblyName: h.assemblyName ?? defaultAssembly }
    : (parseJsonHighlight(h, defaultAssembly) ??
        parseLocHighlight(h, defaultAssembly, isValidRefName))
}

function applyInitHighlights(
  self: LinearGenomeViewModel,
  session: AbstractSessionModel,
  init: InitState,
) {
  for (const h of init.highlight ?? []) {
    const highlight = coerceHighlight(h, init.assembly, refName =>
      session.assemblyManager.isValidRefName(refName, init.assembly),
    )
    if (highlight) {
      self.addToHighlights(highlight)
    }
  }
}

async function applyInit(self: LinearGenomeViewModel, init: InitState) {
  const session = getSession(self)
  warnUnknownInitKeys(init)
  if (init.tracklist) {
    await openTracklist(self, session)
  }
  await navigateInit(self, session, init)
  // the view may have been removed while the assembly/navigation resolved;
  // the mutations below (and setInit in the caller's finally) would throw on a
  // detached node
  if (!isAlive(self)) {
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
  // This autorun is async and only clears `init` at the end, yet it reads
  // volatileWidth (directly for the tracklist-width settle, and via the
  // `initialized` getter) — so a width change mid-apply re-triggers it while
  // `init` is still set, and the second pass re-applies init.highlight as a
  // duplicate (most visible under React StrictMode's double mount, which
  // churns volatileWidth). This plain closure flag (intentionally NOT an
  // observable, so it stays out of the dependency graph) makes re-entrant runs
  // no-op until the in-flight apply finishes and clears init.
  let applyingInit = false
  addDisposer(
    self,
    autorun(
      async function initAutorun() {
        const { init, initialized } = self
        if (!initialized || !init || applyingInit) {
          return
        }
        applyingInit = true
        try {
          await applyInit(self, init)
        } finally {
          // always clear init (even on a thrown apply) so a re-entrant run
          // early-returns, and release the guard for any future setInit;
          // guard isAlive since the apply may have detached the view
          if (isAlive(self)) {
            self.setInit(undefined)
          }
          applyingInit = false
        }
      },
      {
        name: 'LGVInit',
      },
    ),
  )
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
          showTrackOutlines,
          trackLabels,
        } = self
        localStorageSetItem('lgv-showCytobands', s(showCytobands))
        localStorageSetItem('lgv-showCenterLine', s(showCenterLine))
        localStorageSetItem('lgv-colorByCDS', s(colorByCDS))
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
