import { useCallback, useEffect, useMemo, useState } from 'react'

import { settledAs, useReview } from '@jbrowse/browser-test-utils/reviewApp'

import { BackendCard, Card, Pill } from './Card.tsx'
import {
  DRIFTS,
  DRIFT_THRESHOLD,
  KINDS,
  PAGES,
  STATUSES,
  defaultFilters,
  isComparable,
  isDrifting,
  matchesFilters,
  maxDrift,
  needsReview,
} from './filters.ts'

import type {
  ComparePayload,
  SnapshotPayloadEntry,
} from '../review-snapshot-payload.ts'
import type { Diffs, Filters } from './filters.ts'

const errText = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

const PAGE_LABELS = { basic: 'Basic pass', backends: 'Backends' } as const
const STATUS_LABELS = {
  needs: 'Needs review',
  all: 'All',
  good: 'Approved',
  bad: 'Denied',
} as const
const KIND_LABELS = {
  all: 'All',
  targeted: 'Targeted',
  fullpage: 'Full-page',
  svg: 'SVG',
} as const

export function App() {
  const {
    entries,
    loadEntries,
    drafts,
    messages,
    pressed,
    justActed,
    clearJustActed,
    setVerdict,
    saveNote,
    clearVerdict,
  } = useReview<SnapshotPayloadEntry>({
    draftsKey: 'snapshot-review-drafts',
    imageMovedPhrase: 'this snapshot was rewritten',
  })

  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [loadError, setLoadError] = useState<string>()
  const [diffs, setDiffs] = useState<Diffs>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/snapshots')
        const body: unknown = await res.json()
        if (!res.ok || !Array.isArray(body)) {
          throw new Error(
            (body as { error?: string } | null)?.error ?? `HTTP ${res.status}`,
          )
        }
        if (!cancelled) {
          loadEntries(body as SnapshotPayloadEntry[])
        }
      } catch (err) {
        // Say why. An unparseable report is a real case with real recovery
        // instructions in the message loadReport writes, and swallowing it left
        // a blank page that reads as nothing left to review.
        if (!cancelled) {
          setLoadError(errText(err))
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [loadEntries])

  // Backend drift is computed in the background server-side (~25s of PNG
  // decodes), so poll until it says done and let the pills and the drift filter
  // fill in as it goes.
  //
  // This poll is the reason the old client had `repaintUnsafe`: each round
  // rebuilt all of #main, which dropped the caret out of a note being typed and
  // could land between the mousedown and mouseup of an Approve, destroying the
  // button so no click was dispatched at all. Here it is a state update that
  // patches some pills, and there is nothing to guard.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const sleep = (ms: number) =>
      new Promise<void>(res => {
        timer = setTimeout(res, ms)
      })
    async function poll() {
      while (!cancelled) {
        try {
          const r = (await (
            await fetch('/api/compare')
          ).json()) as ComparePayload
          if (cancelled) {
            return
          }
          setDiffs(r.diffs)
          if (r.done) {
            return
          }
        } catch {
          // a failed poll is not worth a message: the next one is 2s away, and
          // the drift pills simply stay absent until one succeeds
        }
        await sleep(2000)
      }
    }
    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const changeFilter = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      clearJustActed()
      setFilters(f => ({ ...f, [key]: value }))
    },
    [clearJustActed],
  )

  const inPage = useMemo(
    () =>
      filters.page === 'backends' ? entries.filter(isComparable) : entries,
    [entries, filters.page],
  )
  const visible = useMemo(
    () => inPage.filter(s => matchesFilters(s, filters, diffs, justActed)),
    [inPage, filters, diffs, justActed],
  )

  const comparable = entries.filter(isComparable).length
  const drifting = entries.filter(s => isDrifting(diffs, s.name)).length

  const counts =
    filters.page === 'basic' ? (
      <>
        <Pill cls="good">
          {inPage.filter(s => settledAs(s, 'good')).length} approved
        </Pill>
        <Pill cls="bad">
          {inPage.filter(s => settledAs(s, 'bad')).length} denied
        </Pill>
        {inPage.filter(s => s.stale).length ? (
          <Pill cls="stale">
            {inPage.filter(s => s.stale).length} changed since review
          </Pill>
        ) : null}
        <Pill cls="none">
          {inPage.filter(s => !s.verdict).length} unreviewed
        </Pill>
      </>
    ) : (
      <>
        <Pill cls="bigdrift">
          {inPage.filter(s => isDrifting(diffs, s.name)).length} drifting ≥
          {DRIFT_THRESHOLD}%
        </Pill>
        <Pill cls="none">{inPage.length} comparable</Pill>
      </>
    )

  return (
    <>
      <header>
        <h1>Snapshot review</h1>
        <div className="tabs">
          {PAGES.map(p => (
            <button
              type="button"
              key={p}
              className={filters.page === p ? 'tab active' : 'tab'}
              onClick={() => {
                changeFilter('page', p)
              }}
            >
              {PAGE_LABELS[p]}
              <span className="tabcount">
                {p === 'basic' ? entries.length : comparable}
              </span>
            </button>
          ))}
        </div>
        <input
          id="search"
          type="search"
          placeholder="filter by name…"
          value={filters.q}
          onChange={e => {
            const { value } = e.target
            setFilters(f => ({ ...f, q: value }))
          }}
        />
        {/* the status tabs only mean anything on the basic-pass page: the
            backends page is read-only and asking a different question */}
        {filters.page === 'basic' ? (
          <div className="tabs">
            {STATUSES.map(s => (
              <button
                type="button"
                key={s}
                className={filters.status === s ? 'tab active' : 'tab'}
                onClick={() => {
                  changeFilter('status', s)
                }}
              >
                {STATUS_LABELS[s]}
                {s === 'needs' ? (
                  <span className="tabcount">
                    {entries.filter(needsReview).length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
        <div className="tabs">
          {KINDS.map(k => (
            <button
              type="button"
              key={k}
              className={filters.kind === k ? 'tab active' : 'tab'}
              onClick={() => {
                changeFilter('kind', k)
              }}
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="tabs">
          {DRIFTS.map(d => (
            <button
              type="button"
              key={d}
              className={filters.drift === d ? 'tab active' : 'tab'}
              onClick={() => {
                changeFilter('drift', d)
              }}
            >
              {d === 'all' ? 'All' : 'Drifting'}
              {d === 'drift' ? (
                <span className="tabcount">{drifting}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="counts">{counts}</div>
      </header>
      <main>
        {loadError ? (
          <div className="loaderror">
            Could not load the snapshot list.{'\n\n'}
            {loadError}
          </div>
        ) : filters.page === 'backends' ? (
          visible.map(entry => (
            <BackendCard key={entry.name} entry={entry} diffs={diffs} />
          ))
        ) : (
          visible.map(entry => (
            <Card
              key={entry.name}
              entry={entry}
              drift={
                diffs[entry.name] ? maxDrift(diffs, entry.name) : undefined
              }
              message={messages[entry.name]}
              pressed={pressed[entry.name]}
              drafts={drafts}
              onSetVerdict={setVerdict}
              onClearVerdict={clearVerdict}
              onSaveNote={saveNote}
            />
          ))
        )}
      </main>
    </>
  )
}
