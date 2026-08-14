import type {
  Screenshot,
  ScreenshotPart,
  BaselineState,
} from './screenshot-review-lib.ts'
import type { Verdict } from '@jbrowse/browser-test-utils'

// What /api/specs and /api/figure-state answer with. Types only, so both halves
// of the review tool can import it: the server (which node runs directly with
// type stripping) and the React page (which esbuild bundles). It used to be
// implicit — the server built an object literal and the page read fields off it
// by hand — which is exactly the seam a renamed field slips through silently.

// What the last sweep had to say about one spec. Absent is a real answer and is
// kept distinct from "fine": a spec the run never reached carries no evidence
// either way, and the UI must not draw it as passing.
export interface SpecRunState {
  failed?: string
  flaky?: number
  updated?: string
  suppressed?: number
  // selected and then deliberately not rendered, with why
  skipped?: string
}

export interface SpecPart extends ScreenshotPart {
  liveUrl?: string
}

export interface SpecEntry extends Screenshot {
  parts: SpecPart[]
  verdict?: Verdict
  // the verdict no longer describes the image on disk
  stale: boolean
  // on this disk but not in the figure store, so nobody else has these pixels
  unpublished: boolean
  run?: SpecRunState
  // the last run never reached this spec: narrowed past it by --filter,
  // --affected or --cover, or added since
  notCovered: boolean
  imageHash: string | null
  liveUrl?: string
}

export interface RunSummary {
  finishedAt: string
  filter: string[]
  check: boolean
  failed: number
  flaky: number
  // how much of the corpus the run reached. `filter` cannot answer that:
  // --affected and --cover narrow just as hard and leave it empty.
  selected: number
  skipped: number
  total: number
}

// The two apps a card's "open live" link can open in. `hosted` is the base every
// liveUrl above was built against (CODE_BASE, which JBROWSE_CODE_BASE
// retargets), so the page can swap it for `local` as a prefix and nothing more —
// it must be the base actually used rather than a constant, or the swap silently
// matches nothing and the toggle does nothing.
export interface LiveBases {
  hosted: string
  local: string
}

export interface FigureState {
  unpublished: string[]
  unpulled: string[]
  total: number
  baseline: BaselineState
  run?: RunSummary
  liveBases: LiveBases
}
