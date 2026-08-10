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

// The status tab only applies on the basic-pass page; the backends page is
// read-only, so filtering it by verdict would hide comparisons for no reason.
export function matchesFilters(
  s: SnapshotPayloadEntry,
  f: Filters,
  diffs: Diffs,
  justActed: ReadonlySet<string>,
) {
  const q = f.q.toLowerCase()
  const matchesStatus =
    f.page !== 'basic' ||
    f.status === 'all' ||
    (f.status === 'needs' ? needsReview(s) : settledAs(s, f.status))
  return (
    (!q || s.name.toLowerCase().includes(q)) &&
    (justActed.has(s.name) ||
      (matchesStatus &&
        (f.kind === 'all' || s.kind === f.kind) &&
        (f.drift === 'all' || isDrifting(diffs, s.name))))
  )
}
