import type {
  Backend,
  BackendDiff,
  SnapshotEntry,
} from './snapshot-review-lib.ts'
import type { Verdict } from '@jbrowse/browser-test-utils'

// What /api/snapshots and /api/compare answer with. Types only, so both halves
// of the review tool can import it: the server (which node runs directly with
// type stripping) and the React page (which esbuild bundles).

export interface SnapshotPayloadEntry extends SnapshotEntry {
  verdict?: Verdict
  // the verdict no longer describes the image on disk
  stale: boolean
  imageHash: string | null
  // which image the card shows — the same pick the hash was taken from, so the
  // two cannot disagree about what a verdict is a verdict on
  refLoc: Backend | 'root' | null
}

export interface ComparePayload {
  diffs: Record<string, BackendDiff[]>
  // false while the background pass is still decoding PNGs; the page polls on it
  done: boolean
}
