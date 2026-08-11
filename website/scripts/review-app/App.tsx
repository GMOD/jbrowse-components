import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  settledAs,
  useReview,
  useStickyQueue,
} from '@jbrowse/browser-test-utils/reviewApp'

import { Card } from './Card.tsx'
import { StoreBanner } from './StoreBanner.tsx'
import {
  COMPARE_MODES,
  KINDS,
  KIND_LABELS,
  SORTS,
  SORT_LABELS,
  hasRunProblem,
  hasStatus,
  isChanged,
  isNew,
  matchesChanged,
  matchesFilters,
  matchesRun,
  matchesScope,
  nameGroup,
  queryKey,
  readUrl,
  searchText,
  writeUrl,
} from './filters.ts'

import type { FigureState, SpecEntry } from '../review-payload.ts'
import type { CompareMode, Filters, Kind, Sort, Status } from './filters.ts'

const errText = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

async function getJson(url: string) {
  const res = await fetch(url)
  const body: unknown = await res.json()
  if (!res.ok) {
    const err = (body as { error?: string } | null)?.error
    throw new Error(err ?? `HTTP ${res.status}`)
  }
  return body
}

// Every number in the header counts something a verdict changes, so each sits in
// a fixed-width slot and each pill is drawn even at zero. See the header rule in
// app.css for what a header that resizes does to the figure below it.
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
  answered: 'Nothing is awaiting your call',
  bad: 'Nothing is denied',
  all: 'There are no figures',
}

// What no cards means. `dataEpoch` is 0 until /api/specs lands, and that request
// takes as long as hashing the figure corpus — long enough that "nothing needs
// review" would otherwise be the page's answer for the first second of every
// load, which is the one wrong answer here that reads as good news.
function emptyText(dataEpoch: number, f: Filters) {
  if (!dataEpoch) {
    return 'Loading the screenshot list…'
  }
  const narrowed =
    !!searchText(f) ||
    !!f.group ||
    f.kind !== 'all' ||
    f.changedOnly ||
    f.runOnly
  return `${NOTHING[f.status]}${narrowed ? ' under these filters' : ''}.`
}

const TABS: { status: Status; label: string }[] = [
  { status: 'needs', label: 'Needs review' },
  { status: 'good', label: 'Approved' },
  { status: 'answered', label: 'Answered' },
  { status: 'bad', label: 'Denied' },
]

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
  } = useReview<SpecEntry>({
    draftsKey: 'screenshot-review-drafts',
    imageMovedPhrase: 'this figure was regenerated',
  })

  const [filters, setFilters] = useState(readUrl)
  // Bumped when a page load replaces the entries, which is the other thing that
  // makes the captured queue the answer to a stale question — the first capture
  // is taken before the fetch lands and is empty.
  const [dataEpoch, setDataEpoch] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
  const [figureState, setFigureState] = useState<FigureState>()
  const [figureError, setFigureError] = useState<string>()
  // The header sets the default compare mode and a card's own control overrides
  // it, so changing the default drops the overrides: otherwise switching
  // everything to onion would silently leave behind whichever cards had been
  // switched individually.
  const [overrides, setOverrides] = useState<Record<string, CompareMode>>({})

  // The fetch behind the whole page, run on mount and again whenever the
  // reviewer asks for it.
  //
  // Asking for it is the point: the review loop is regenerate, look again, and
  // the only way to see the new picture used to be a browser reload. That
  // answers it badly — the request below takes as long as hashing the figure
  // corpus, so the document is still empty when the browser tries to put the
  // scroll position back, and the reviewer lands at the top of 328 cards having
  // been most of the way down them. Re-fetching in place keeps the scroll, the
  // note drafts and the per-card compare modes.
  //
  // `run` is which fetch is the current one. A response from an earlier one — a
  // slow first load still in flight when Reload is pressed, or either of them
  // outliving the page — belongs to nobody and is dropped.
  const run = useRef(0)
  const load = useCallback(async () => {
    const mine = ++run.current
    const current = () => mine === run.current
    setLoading(true)
    let specs: SpecEntry[]
    try {
      const body = await getJson('/api/specs')
      if (!Array.isArray(body)) {
        throw new Error('the spec list was not an array')
      }
      specs = body as SpecEntry[]
    } catch (err) {
      // Say why. The report being unparseable is a real case with real
      // recovery instructions in the message (loadReport writes them), and
      // swallowing this left an empty page that looked like a review with
      // nothing left to do.
      if (current()) {
        setLoadError(errText(err))
        setLoading(false)
      }
      return
    }
    // The banner is fetched before the first card is drawn, and after
    // /api/specs has answered.
    //
    // Before the cards, because the banner is four lines of prose above main:
    // it used to land ~120ms after them, shoving every card down 217px a tenth
    // of a second after they became clickable, and a press straddling that has
    // its button moved out from under the pointer.
    //
    // After /api/specs, because this endpoint answers from the working-tree
    // scan that request refreshes. The two used to be issued together and this
    // one relied on arriving second — but they go out on two sockets, and
    // nothing made that true. Losing the race meant hashing the 68 MB of
    // figures twice, and on a reload after a regen it meant a banner
    // describing the tree as it was before it.
    try {
      const state = (await getJson('/api/figure-state')) as FigureState
      if (current()) {
        setFigureState(state)
        setFigureError(undefined)
      }
    } catch (err) {
      if (current()) {
        setFigureError(errText(err))
      }
    }
    if (current()) {
      setLoadError(undefined)
      loadEntries(specs)
      setDataEpoch(e => e + 1)
      // drop a restored group filter that no longer names an existing group
      const groups = new Set(specs.map(s => nameGroup(s.name)))
      setFilters(f =>
        !f.group || groups.has(f.group) ? f : { ...f, group: '' },
      )
      setLoading(false)
    }
  }, [loadEntries])

  // No cleanup: `run` already drops the response of any fetch that is no longer
  // the current one, which is the race that actually happens here — Reload
  // pressed while the first load is still hashing the corpus. Unmount is not
  // one: App is the root, main.tsx deliberately does not wrap it in StrictMode,
  // and this effect's only dependency is a callback over a stable setter.
  useEffect(() => {
    void load()
  }, [load])

  // Canonicalizes as well as persists: a shared URL naming a group that no
  // longer exists is rewritten once the data says so.
  useEffect(() => {
    writeUrl(filters)
  }, [filters])

  const changeFilter = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters(f => ({ ...f, [key]: value }))
    },
    [],
  )

  const onCompareMode = useCallback((name: string, mode: CompareMode) => {
    setOverrides(o => ({ ...o, [name]: mode }))
  }, [])

  const groups = useMemo(
    () => [...new Set(entries.map(s => nameGroup(s.name)))].sort(),
    [entries],
  )

  const matching = useMemo(() => {
    const list = entries.filter(s => matchesFilters(s, filters))
    if (filters.sortBy !== 'recent') {
      return list
    }
    const at = (s: SpecEntry) =>
      s.verdict ? new Date(s.verdict.reviewedAt).getTime() : 0
    return [...list].sort((a, b) => at(b) - at(a))
  }, [entries, filters])

  // The cards on screen are a capture of that query, not the query itself, so
  // approving or denying one never moves, reorders or removes anything: it is
  // the reviewer who decides when a settled card leaves, per card or by the
  // batch.
  const { queue, leaving, refresh, dismiss } = useStickyQueue({
    entries,
    matching,
    viewKey: `${dataEpoch} ${queryKey(filters)}`,
  })

  // A badge answers "how many cards do I get if I click this", so it counts
  // within the group/kind/search scope and under every OTHER control's current
  // setting, replacing only its own predicate. A global 42 above a filtered view
  // showing 3 reads as a broken filter.
  const scoped = useMemo(
    () => entries.filter(s => matchesScope(s, filters)),
    [entries, filters],
  )
  const tabCount = (status: Status) =>
    scoped.filter(
      s =>
        hasStatus(s, status) &&
        matchesChanged(s, filters) &&
        matchesRun(s, filters),
    ).length
  // The two toggles count what turning them ON would leave, which means
  // honouring the status tab and each other. They used to honour neither, so
  // 'Changed vs main' read 40 over a needs-review queue that would show 3.
  const changedCount = scoped.filter(
    s =>
      hasStatus(s, filters.status) &&
      matchesRun(s, filters) &&
      (isNew(s) || isChanged(s)),
  ).length
  const runCount = scoped.filter(
    s =>
      hasStatus(s, filters.status) &&
      matchesChanged(s, filters) &&
      hasRunProblem(s),
  ).length

  // The pill row stays global: that one is the progress reading for the whole
  // sweep, not a preview of what a control would show.
  const settled = (status: 'good' | 'bad' | 'answered') =>
    entries.filter(s => settledAs(s, status)).length
  const stale = entries.filter(s => s.stale).length

  return (
    <>
      <header>
        <h1>Screenshot review</h1>
        <input
          id="search"
          type="search"
          placeholder="filter by name…"
          value={filters.q}
          // deliberately does not clear justActed: typing in the search box is
          // not leaving the view a card was acted on in
          onChange={e => {
            const { value } = e.target
            setFilters(f => ({ ...f, q: value }))
          }}
        />
        <label className="ctrl">
          <span>Group</span>
          <select
            title="Filter by name group"
            value={filters.group}
            onChange={e => {
              changeFilter('group', e.target.value)
            }}
          >
            <option value="">All groups</option>
            {groups.map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="ctrl">
          <span>Kind</span>
          <select
            title="Filter by how the image is produced"
            value={filters.kind}
            onChange={e => {
              changeFilter('kind', e.target.value as Kind)
            }}
          >
            {KINDS.map(k => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="ctrl">
          <span>Compare</span>
          <select
            title="How each card shows the current image against origin/main"
            value={filters.compare}
            onChange={e => {
              // the default these overrode has moved, so the overrides no longer
              // mean what the reviewer set them to
              setOverrides({})
              changeFilter('compare', e.target.value as CompareMode)
            }}
          >
            {COMPARE_MODES.map(([id, , , label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="ctrl">
          <span>Sort</span>
          <select
            title="Sort order"
            value={filters.sortBy}
            onChange={e => {
              changeFilter('sortBy', e.target.value as Sort)
            }}
          >
            {SORTS.map(s => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="tabs">
          {TABS.map(t => (
            <button
              type="button"
              key={t.status}
              className={filters.status === t.status ? 'tab active' : 'tab'}
              onClick={() => {
                changeFilter('status', t.status)
              }}
            >
              {t.label}
              <Count n={tabCount(t.status)} />
            </button>
          ))}
          <button
            type="button"
            className={filters.status === 'all' ? 'tab active' : 'tab'}
            onClick={() => {
              changeFilter('status', 'all')
            }}
          >
            All
          </button>
        </div>
        <button
          type="button"
          className={filters.changedOnly ? 'tab active' : 'tab'}
          title="only screenshots new or changed vs origin/main"
          onClick={() => {
            changeFilter('changedOnly', !filters.changedOnly)
          }}
        >
          Changed vs main
          <Count n={changedCount} />
        </button>
        <button
          type="button"
          className={filters.runOnly ? 'tab active' : 'tab'}
          title="only specs the last run failed to render, rendered differently twice, or kept behind a raised diffThreshold"
          onClick={() => {
            changeFilter('runOnly', !filters.runOnly)
          }}
        >
          Render problems
          <Count n={runCount} />
        </button>
        {/* The one control that removes cards from the list, so that removing
            them is something the reviewer does rather than something that
            happens to them mid-note. Invisible until there is something to
            clear, which also makes it the progress readout for the batch in
            front of you — the pill row to its right counts the whole sweep. */}
        <button
          type="button"
          className={leaving.size ? 'tab flush' : 'tab flush reserved'}
          title="These are settled and no longer match the filters — take them off the list"
          onClick={refresh}
        >
          Clear settled
          <Count n={leaving.size} />
        </button>
        {/* Fixed label and no count, per the header rule above: `disabled` is
            the whole of the in-flight state because it recolours without
            resizing, and a spinner or a "Reloading…" would move every figure on
            the page the moment the request went out. */}
        <button
          type="button"
          className="tab"
          disabled={loading}
          title="Re-read the figures on disk without reloading the page — after a regen, this is the thing to press"
          onClick={() => {
            void load()
          }}
        >
          Reload figures
        </button>
        <div className="counts">
          <CountPill cls="good" n={settled('good')} label="approved" />
          <CountPill cls="bad" n={settled('bad')} label="denied" />
          <CountPill
            cls="answered"
            n={settled('answered')}
            label="answered, awaiting you"
          />
          <CountPill cls="stale" n={stale} label="changed since review" />
          <CountPill
            cls="none"
            n={entries.filter(s => !s.verdict).length}
            label="unreviewed"
          />
        </div>
      </header>
      <StoreBanner state={figureState} error={figureError} />
      <main>
        {/* Above the cards rather than instead of them. A failed RELOAD leaves
            the last good list on screen and still reviewable — throwing it away
            to show the message would cost the reviewer their place over a
            request that changed nothing. On a failed first load there is
            nothing below it anyway. */}
        {loadError ? (
          <div className="loaderror">
            {dataEpoch
              ? 'Could not reload — the cards below are from the last load that worked.'
              : 'Could not load the screenshot list.'}
            {'\n\n'}
            {loadError}
          </div>
        ) : null}
        {queue.map(spec => (
          <Card
            key={spec.name}
            spec={spec}
            message={messages[spec.name]}
            pressed={pressed[spec.name]}
            drafts={drafts}
            settled={leaving.has(spec.name)}
            compareMode={overrides[spec.name] ?? filters.compare}
            onCompareMode={onCompareMode}
            onSetVerdict={setVerdict}
            onClearVerdict={clearVerdict}
            onSaveNote={saveNote}
            onDismiss={dismiss}
          />
        ))}
        {/* An empty list under filters that DO select things is the one state
            the reviewer cannot tell from "nothing left to review": the queue is
            a capture, so it stays empty until it is retaken. */}
        {!loadError && !queue.length && matching.length ? (
          <button type="button" className="tab requeue" onClick={refresh}>
            {matching.length} card{matching.length === 1 ? '' : 's'} match these
            filters — load them
          </button>
        ) : null}
        {/* …and an empty list under filters that select NOTHING has to say so
            out loud. Bare, `main` renders as blank page, which is what a review
            server that failed to start, a bad bookmark and a finished sweep all
            look like — and only one of those is worth celebrating. */}
        {!loadError && !queue.length && !matching.length ? (
          <div className="empty">{emptyText(dataEpoch, filters)}</div>
        ) : null}
      </main>
    </>
  )
}
