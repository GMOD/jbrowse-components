import { settledAs } from '@jbrowse/browser-test-utils/reviewApp'

import type { SnapshotPayloadEntry } from '../review-snapshot-payload.ts'
import type { BackendDiff } from '../snapshot-review-lib.ts'

// percent; mirrors compare-backends.ts's similar/different split
export const DRIFT_THRESHOLD = 5

export const PAGES = ['basic', 'backends'] as const
export const STATUSES = ['needs', 'all', 'good', 'bad'] as const
export const KINDS = ['all', 'targeted', 'fullpage', 'svg'] as const
export const DRIFTS = ['all', 'drift'] as const

export type Page = (typeof PAGES)[number]
export type Status = (typeof STATUSES)[number]
export type Kind = (typeof KINDS)[number]
export type Drift = (typeof DRIFTS)[number]

export interface Filters {
  q: string
  page: Page
  status: Status
  kind: Kind
  drift: Drift
}

export const defaultFilters: Filters = {
  q: '',
  page: 'basic',
  status: 'needs',
  kind: 'all',
  drift: 'all',
}

export type Diffs = Record<string, BackendDiff[]>

// A snapshot needs review when it has no verdict, or its verdict went stale
// because the reviewed image changed since.
export const needsReview = (s: SnapshotPayloadEntry) => !s.verdict || s.stale

// Only a PNG captured by two or more backends has anything to compare.
export const isComparable = (s: SnapshotPayloadEntry) =>
  !s.isSvg && s.backends.length >= 2

// Worst pairwise drift % across backends for a snapshot, or -1 if not
// comparable — which is distinct from 0, and the pill says so.
export function maxDrift(diffs: Diffs, name: string) {
  let worst = -1
  for (const p of diffs[name] ?? []) {
    if (typeof p.diffFraction === 'number') {
      worst = Math.max(worst, p.diffFraction * 100)
    }
  }
  return worst
}

export const isDrifting = (diffs: Diffs, name: string) =>
  maxDrift(diffs, name) >= DRIFT_THRESHOLD

// Trimmed, because no snapshot name contains a space: an unnoticed trailing one
// — pasted, or left behind by a keyboard that space-completes — otherwise
// selects nothing at all, and an empty list with no card on it reads as a
// finished queue rather than as a typo in the search box.
export const searchText = (f: Filters) => f.q.trim().toLowerCase()

// The status tab only applies on the basic-pass page; the backends page is
// read-only, so filtering it by verdict would hide comparisons for no reason.
export function matchesFilters(
  s: SnapshotPayloadEntry,
  f: Filters,
  diffs: Diffs,
) {
  const q = searchText(f)
  const matchesStatus =
    f.page !== 'basic' ||
    f.status === 'all' ||
    (f.status === 'needs' ? needsReview(s) : settledAs(s, f.status))
  return (
    (!q || s.name.toLowerCase().includes(q)) &&
    matchesStatus &&
    (f.kind === 'all' || s.kind === f.kind) &&
    (f.drift === 'all' || isDrifting(diffs, s.name))
  )
}

// Which of a card's own properties the list is selected on: change one and the
// reviewer is asking a different question, so useStickyQueue re-captures.
//
// `diffs` is deliberately absent even though the drift filter reads it. It
// arrives over ~25s of background PNG decoding, so folding it in would re-take
// the capture every two seconds — throwing away the batch under the reviewer,
// repeatedly, for the whole first half-minute. The queue's `pending` count says
// the answer has grown instead, and the reviewer takes it when they are ready.
export const queryKey = (f: Filters) =>
  [searchText(f), f.page, f.status, f.kind, f.drift].join(' ')
