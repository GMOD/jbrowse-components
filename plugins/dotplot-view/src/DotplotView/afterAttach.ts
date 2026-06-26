import {
  getSession,
  localStorageSetItem,
  parseLocString,
} from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, when } from 'mobx'

import { LS_CURSOR_MODE } from './types.ts'

import type { DotplotViewModel } from './model.ts'
import type { DotplotViewInit } from './types.ts'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { HighlightType } from '@jbrowse/plugin-linear-genome-view'

type AssemblyManager = ReturnType<typeof getSession>['assemblyManager']

// colorBy/minAlignmentLength live on each display, not the view. tracks and
// displays are pluggable so the setters are feature-detected.
interface DotplotDisplaySettings {
  setColorBy?: (v: string) => void
  setMinAlignmentLength?: (v: number) => void
}

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

// Resolve init.highlight entries to HighlightType objects. Each entry is a loc
// string ("ctgA:100-200") or a JSON object carrying color/label, mirroring
// LinearGenomeView's init.highlight. Pure — no view dependency — so it is unit
// testable on its own.
export function parseInitHighlights(
  entries: string[],
  assemblyManager: AssemblyManager,
  defaultAssembly: string,
): HighlightType[] {
  const out: HighlightType[] = []
  for (const h of entries) {
    const json = h.trim().startsWith('{') && tryParseJson(h)
    if (
      json &&
      typeof json.refName === 'string' &&
      typeof json.start === 'number' &&
      typeof json.end === 'number'
    ) {
      out.push({
        refName: json.refName,
        start: json.start,
        end: json.end,
        assemblyName:
          typeof json.assemblyName === 'string'
            ? json.assemblyName
            : defaultAssembly,
        color: typeof json.color === 'string' ? json.color : undefined,
        label: typeof json.label === 'string' ? json.label : undefined,
      })
    } else {
      const p = parseLocString(h, refName =>
        assemblyManager.isValidRefName(refName, defaultAssembly),
      )
      const { start, end } = p
      if (start !== undefined && end !== undefined) {
        out.push({ ...p, start, end, assemblyName: defaultAssembly })
      }
    }
  }
  return out
}

// Navigate one dotplot axis (hview/vview) to a loc string for region-based
// linking. Resolves the canonical refName, finds the matching displayed region,
// and moveTo's the bp offsets (handling reversed regions). Exported for tests.
export function navAxisToLoc(
  view: Base1DViewModel,
  loc: string,
  assemblyName: string,
  assemblyManager: AssemblyManager,
) {
  const asm = assemblyManager.get(assemblyName)
  const {
    refName: parsedRef,
    start,
    end,
  } = parseLocString(loc, refName =>
    assemblyManager.isValidRefName(refName, assemblyName),
  )
  if (start !== undefined && end !== undefined) {
    const refName = asm?.getCanonicalRefName(parsedRef) ?? parsedRef
    const index = view.displayedRegions.findIndex(r => r.refName === refName)
    if (index !== -1) {
      const region = view.displayedRegions[index]!
      const o1 = region.reversed ? region.end - start : start - region.start
      const o2 = region.reversed ? region.end - end : end - region.start
      const [lo, hi] = o1 < o2 ? [o1, o2] : [o2, o1]
      view.moveTo(
        { refName, index, offset: lo },
        { refName, index, offset: hi },
      )
    }
  }
}

// Bounded wait: resolves when cond() turns true or after ms, whichever first.
// Used to keep init steps from deadlocking on a display/region that never
// becomes ready.
async function waitFor(cond: () => boolean, ms: number) {
  await Promise.race([
    when(cond),
    new Promise(resolve => {
      setTimeout(resolve, ms)
    }),
  ])
}

function applyInitTracks(self: DotplotViewModel, init: DotplotViewInit) {
  // showTrack surfaces its own failures via showTrackGeneric's notifyError
  if (init.tracks) {
    for (const trackId of init.tracks) {
      self.showTrack(trackId)
    }
  }
}

function applyInitDisplaySettings(
  self: DotplotViewModel,
  init: DotplotViewInit,
) {
  if (init.colorBy !== undefined || init.minAlignmentLength !== undefined) {
    for (const track of self.tracks) {
      for (const display of track.displays) {
        const d = display as DotplotDisplaySettings
        if (init.colorBy && d.setColorBy) {
          d.setColorBy(init.colorBy)
        }
        if (init.minAlignmentLength !== undefined && d.setMinAlignmentLength) {
          d.setMinAlignmentLength(init.minAlignmentLength)
        }
      }
    }
  }
}

function applyInitHighlights(self: DotplotViewModel, init: DotplotViewInit) {
  if (init.highlight) {
    const { assemblyManager } = getSession(self)
    const highlights = parseInitHighlights(
      init.highlight,
      assemblyManager,
      self.assemblyNames[0]!,
    )
    for (const h of highlights) {
      self.addToHighlights(h)
    }
  }
}

async function runAutoDiagonalize(self: DotplotViewModel) {
  // runDotplotDiagonalize reads the axes' displayedRegions and fetches the
  // alignments it needs in its own RPC, so the only precondition is that the
  // view's regions are populated (assemblies loaded) — not the display's render
  // fetch. Wait on `initialized` directly so a slow remote load can't expire a
  // fixed ceiling and skip the reorder, leaving an undiagonalized plot; bail if
  // the assemblies error out. awaitingAutoDiagonalize flips showLoading on so
  // the user sees a "Reordering chromosomes…" spinner meanwhile.
  self.setAwaitingAutoDiagonalize(true)
  try {
    const { runDotplotDiagonalize } =
      await import('./util/runDotplotDiagonalize.ts')
    await when(
      () => self.initialized || !!self.volatileError || !!self.assemblyErrors,
    )
    if (self.initialized && isAlive(self)) {
      await runDotplotDiagonalize(self)
    }
  } catch (e) {
    console.error(e)
  } finally {
    if (isAlive(self)) {
      self.setAwaitingAutoDiagonalize(false)
    }
  }
}

// region-based linking: navigate each axis to its requested loc. Assumes the
// view is already initialized (caller waits) so displayed regions exist.
function navigateInitLocs(self: DotplotViewModel, init: DotplotViewInit) {
  const { assemblyManager } = getSession(self)
  const axes = [self.hview, self.vview]
  for (const [i, v] of init.views.entries()) {
    const axis = axes[i]
    if (v.loc && axis) {
      navAxisToLoc(axis, v.loc, self.assemblyNames[i]!, assemblyManager)
    }
  }
}

function setupInitAutorun(self: DotplotViewModel) {
  // hand-rolled re-entry guard: the autorun is async, and observables it reads
  // (volatileWidth) can change mid-await and retrigger it before it finishes
  let initRunning = false
  addDisposer(
    self,
    autorun(
      async function dotplotInitAutorun() {
        const { init, volatileWidth } = self
        if (!volatileWidth || !init || initRunning) {
          return
        }
        initRunning = true
        try {
          // a dotplot needs two axes. LaunchDotplotView enforces this, but a
          // hand-authored init (set via addView, bypassing the launcher) could
          // be malformed — fail loudly instead of silently producing a
          // [assembly, undefined] axis pair
          if (init.views.length < 2) {
            getSession(self).notifyError(
              `DotplotView init requires 2 views, got ${init.views.length}`,
            )
          } else {
            const [target, query] = init.views.map(v => v.assembly)
            self.setAssemblyNames(target!, query!)
            applyInitTracks(self, init)
            applyInitDisplaySettings(self, init)
            if (init.autoDiagonalize) {
              await runAutoDiagonalize(self)
            }
            // highlights call isValidRefName, which throws until the assembly
            // loads, so they need assembliesInitialized. loc-nav additionally
            // needs displayed regions (initialized). Wait for the stronger of
            // the two that are actually requested, then apply each once its own
            // precondition holds.
            const hasHighlight = !!init.highlight?.length
            const hasLoc = init.views.some(v => v.loc)
            if (hasHighlight || hasLoc) {
              await waitFor(
                () => (hasLoc ? self.initialized : self.assembliesInitialized),
                30_000,
              )
              if (isAlive(self)) {
                if (hasHighlight && self.assembliesInitialized) {
                  applyInitHighlights(self, init)
                }
                if (hasLoc && self.initialized) {
                  navigateInitLocs(self, init)
                }
              }
            }
          }
          if (isAlive(self)) {
            self.setInit(undefined)
          }
        } catch (e) {
          // a bad highlight/loc entry must not nuke the whole view init; clear
          // init so the autorun doesn't retry-loop on the same failure
          console.error(e)
          if (isAlive(self)) {
            getSession(self).notifyError(`${e}`, e)
            self.setInit(undefined)
          }
        } finally {
          initRunning = false
        }
      },
      { name: 'DotplotInit' },
    ),
  )
}

function setupLocalStorageAutorun(self: DotplotViewModel) {
  addDisposer(
    self,
    autorun(
      function dotplotLocalStorageAutorun() {
        localStorageSetItem(LS_CURSOR_MODE, self.cursorMode)
      },
      { name: 'DotplotLocalStorage' },
    ),
  )
}

function setupRegionsAutorun(self: DotplotViewModel) {
  addDisposer(
    self,
    autorun(
      function dotplotRegionsAutorun() {
        // assemblyNames.length > 0 both tracks the array (so MobX re-runs when
        // names change) and guards against vacuous truth from every() on an
        // empty array after clearView().
        if (
          self.volatileWidth !== undefined &&
          self.assemblyNames.length > 0 &&
          self.assembliesInitialized
        ) {
          self.initializeDisplayedRegions()
        }
      },
      { delay: 1000, name: 'DotplotRegions' },
    ),
  )
}

function setupAspectLockAutorun(self: DotplotViewModel) {
  addDisposer(
    self,
    autorun(
      function dotplotAspectLockAutorun() {
        if (self.lockAspectRatio) {
          self.syncBpPerPx()
        }
      },
      { name: 'DotplotAspectLock' },
    ),
  )
}

function setupBorderAutorun(self: DotplotViewModel) {
  addDisposer(
    self,
    autorun(
      function dotplotBorderAutorun() {
        if (self.volatileWidth !== undefined) {
          const { borderX, borderY } = self.calculateBorders()
          self.setBorderX(borderX)
          self.setBorderY(borderY)
        }
      },
      { name: 'DotplotBorder' },
    ),
  )
}

export function doAfterAttach(self: DotplotViewModel) {
  setupInitAutorun(self)
  setupLocalStorageAutorun(self)
  setupRegionsAutorun(self)
  setupAspectLockAutorun(self)
  setupBorderAutorun(self)
}
