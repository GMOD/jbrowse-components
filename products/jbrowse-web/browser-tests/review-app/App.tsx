import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  settledAs,
  useReview,
  useStickyQueue,
} from '@jbrowse/browser-test-utils/reviewApp'

import { BackendCard, Card } from './Card.tsx'
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
  queryKey,
  searchText,
} from './filters.ts'

import type {
  ComparePayload,
  SnapshotPayloadEntry,
} from '../review-snapshot-payload.ts'
import type { Diffs, Filters, Status } from './filters.ts'

const errText = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

// A count that cannot change the width of what holds it: 9 → 10 → 199 all draw
// in the same box. Every number in this header moves — verdicts change the tab
// counts, and the background drift pass walks `drifting` from 0 up over ~25s —
// and the header is a wrapping flex row directly above the cards, so a number
// that widens its tab can add a line and shove every snapshot on the page down
// by it. Mid-press, that is a click the browser never dispatches.
function Count({ n }: { n: number }) {
  return <span className="tabcount">{n}</span>
}

function CountPill({
  cls,
  n,
  label,
}: {
  cls: string
  n: number
  label: string
}) {
  return (
    <span className={`pill ${cls}`}>
      <Count n={n} /> {label}
    </span>
  )
}

const NOTHING: Record<Status, string> = {
  needs: 'Nothing needs review',
  good: 'Nothing is approved',
  bad: 'Nothing is denied',
  all: 'There are no snapshots',
}

// What no cards means. `dataEpoch` is 0 until /api/snapshots lands, and until it
// does "nothing needs review" is the one wrong answer here that reads as good
// news.
function emptyText(dataEpoch: number, f: Filters) {
  if (!dataEpoch) {
    return 'Loading the snapshot list…'
  }
  const narrowed = !!searchText(f) || f.kind !== 'all' || f.drift !== 'all'
  const scope = narrowed ? ' under these filters' : ''
  return f.page === 'backends'
    ? `No snapshot was captured by two or more backends${scope} — there is nothing to compare.`
    : `${NOTHING[f.status]}${scope}.`
}

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
    setVerdict,
    saveNote,
    clearVerdict,
  } = useReview<SnapshotPayloadEntry>({
    draftsKey: 'snapshot-review-drafts',
    imageMovedPhrase: 'this snapshot was rewritten',
  })

  const [filters, setFilters] = useState<Filters>(defaultFilters)
  // Bumped when the fetch lands. Without it the queue's first capture — taken
  // before the data arrives, so empty — would be the answer for the session.
  const [dataEpoch, setDataEpoch] = useState(0)
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
          setDataEpoch(e => e + 1)
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
          // `cancelled` is only ever assigned by the cleanup closure below, so
          // the checker narrows it to `false` for the whole loop body and calls
          // this check dead. It is not: the effect can be torn down during the
          // await, and without this the teardown races a setDiffs on an
          // unmounted tree.
          // oxlint-disable-next-line typescript/no-unnecessary-condition
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
      setFilters(f => ({ ...f, [key]: value }))
    },
    [],
  )

  const inPage = useMemo(
    () =>
      filters.page === 'backends' ? entries.filter(isComparable) : entries,
    [entries, filters.page],
  )
  const matching = useMemo(
    () => inPage.filter(s => matchesFilters(s, filters, diffs)),
    [inPage, filters, diffs],
  )

  // The cards on screen are a capture of that query, not the query itself, so
  // approving or denying one never removes anything: it is the reviewer who
  // decides when a settled card leaves, per card or by the batch.
  //
  // This replaces a `justActed` set that exempted the acted-on rows from the
  // filter instead of holding the list still. It kept a card on screen, but it
  // also kept every card ever acted on, so a needs-review queue slowly filled
  // with work already done and nothing said which; and any filter click dropped
  // the whole set at once, including the card whose reason was half typed.
  const { queue, leaving, pending, refresh, dismiss } = useStickyQueue({
    entries: inPage,
    matching,
    viewKey: `${dataEpoch} ${queryKey(filters)}`,
  })

  const comparable = entries.filter(isComparable).length
  const drifting = entries.filter(s => isDrifting(diffs, s.name)).length

  // Every number here counts something a verdict or the drift pass changes, so
  // each sits in a fixed-width slot and each pill is drawn even at zero — see
  // the header rule in app.css for what a header that rewraps does to the cards
  // below it.
  const counts =
    filters.page === 'basic' ? (
      <>
        <CountPill
          cls="good"
          n={inPage.filter(s => settledAs(s, 'good')).length}
          label="approved"
        />
        <CountPill
          cls="bad"
          n={inPage.filter(s => settledAs(s, 'bad')).length}
          label="denied"
        />
        <CountPill
          cls="stale"
          n={inPage.filter(s => s.stale).length}
          label="changed since review"
        />
        <CountPill
          cls="none"
          n={inPage.filter(s => !s.verdict).length}
          label="unreviewed"
        />
      </>
    ) : (
      <>
        <CountPill
          cls="bigdrift"
          n={inPage.filter(s => isDrifting(diffs, s.name)).length}
          label={`drifting ≥${DRIFT_THRESHOLD}%`}
        />
        <CountPill cls="none" n={inPage.length} label="comparable" />
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
              <Count n={p === 'basic' ? entries.length : comparable} />
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
                  <Count n={entries.filter(needsReview).length} />
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
              {d === 'drift' ? <Count n={drifting} /> : null}
            </button>
          ))}
        </div>
        {/* The one control that takes cards off the list, so that removing them
            is something the reviewer does rather than something that happens to
            them mid-note. Invisible until there is something to clear — which
            also makes it the progress readout for the batch in front of you.
            Always MOUNTED though, `reserved` rather than absent, because this
            row is directly above the cards. */}
        <button
          type="button"
          className={leaving.size ? 'tab flush' : 'tab flush reserved'}
          title="These are settled and no longer match the filters — take them off the list"
          onClick={refresh}
        >
          Clear settled
          <Count n={leaving.size} />
        </button>
        <div className="counts">{counts}</div>
      </header>
      <main>
        {loadError ? (
          <div className="loaderror">
            Could not load the snapshot list.{'\n\n'}
            {loadError}
          </div>
        ) : null}
        {filters.page === 'backends'
          ? queue.map(entry => (
              <BackendCard key={entry.name} entry={entry} diffs={diffs} />
            ))
          : queue.map(entry => (
              <Card
                key={entry.name}
                entry={entry}
                drift={
                  diffs[entry.name] ? maxDrift(diffs, entry.name) : undefined
                }
                comparable={isComparable(entry)}
                message={messages[entry.name]}
                pressed={pressed[entry.name]}
                drafts={drafts}
                settled={leaving.has(entry.name)}
                onSetVerdict={setVerdict}
                onClearVerdict={clearVerdict}
                onSaveNote={saveNote}
                onDismiss={dismiss}
              />
            ))}
        {/* The live query selects things this capture does not hold — either it
            was taken before the data landed, or the drift pass has since found
            more. Either way the reviewer cannot tell that from a finished
            queue, so say it and let them take the new answer when they want it
            rather than having the list rearrange itself under them. */}
        {!loadError && pending ? (
          <button type="button" className="tab requeue" onClick={refresh}>
            {pending} more match{pending === 1 ? 'es' : ''} these filters — load
            {pending === 1 ? ' it' : ' them'}
          </button>
        ) : null}
        {/* A blank main is what a review server that failed to start, a typo in
            the search box and a finished sweep all look like, and only one of
            those is worth celebrating. */}
        {!loadError && !queue.length && !pending ? (
          <div className="empty">{emptyText(dataEpoch, filters)}</div>
        ) : null}
      </main>
    </>
  )
}
