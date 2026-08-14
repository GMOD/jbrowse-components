import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  errorText,
  useReview,
  useStickyQueue,
} from '@jbrowse/browser-test-utils/reviewApp'

import { Card } from './Card.tsx'
import { CompareViewProvider } from './Compare.tsx'
import { Header } from './Header.tsx'
import { StoreBanner } from './StoreBanner.tsx'
import {
  matchesBeyondScope,
  matchesScope,
  nameGroup,
  queryKey,
  readUrl,
  searchText,
  writeUrl,
} from './filters.ts'
import { liveLabelsOf, liveTargetOf } from './liveLinks.ts'

import type { FigureState, SpecEntry } from '../review-payload.ts'
import type { CompareMode, Filters, Status } from './filters.ts'

// A response is not always JSON. A 404 from the wrong port — which this server
// warns is a routine collision — answers in text, and parsing that first turns
// the message the reviewer gets from "HTTP 404" into a complaint about the word
// "not". Read the body leniently and let the status speak.
async function getJson(url: string) {
  const res = await fetch(url)
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (body as { error?: string } | null)?.error
    throw new Error(err ?? `HTTP ${res.status}`)
  }
  if (body === null) {
    throw new Error(`${url} answered ${res.status} with something not JSON`)
  }
  return body
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
        setLoadError(errorText(err))
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
        setFigureError(errorText(err))
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

  // The header control and every card's own segmented buttons are the same
  // setting reached from two places: pressing onion on the card in front of you
  // is how you say "show me all of them this way", which is what a reviewer
  // means by it. It sits in the filters because it is the one way-of-looking
  // worth keeping in the URL — see queryKey for why it does not re-capture the
  // queue.
  const onCompareMode = useCallback(
    (mode: CompareMode) => {
      changeFilter('compare', mode)
    },
    [changeFilter],
  )

  const groups = useMemo(
    () => [...new Set(entries.map(s => nameGroup(s.name)))].sort(),
    [entries],
  )

  // Where a card's "Open live in JBrowse" points. The two bases arrive with the
  // figure state, which lands before the first card is drawn — until then there
  // is nothing to retarget to and the links stay hosted, which is also what a
  // card with no local equivalent gets.
  const liveBases = figureState?.liveBases
  const liveTarget = useMemo(
    () => liveTargetOf(liveBases, filters.live),
    [liveBases, filters.live],
  )
  const liveLabels = useMemo(() => liveLabelsOf(liveBases), [liveBases])

  // Two passes, in the order the header needs them: the group/kind/search scope
  // is what a badge counts within, and the rest of the filters narrow it to what
  // is actually on the list.
  const scoped = useMemo(
    () => entries.filter(s => matchesScope(s, filters)),
    [entries, filters],
  )
  const matching = useMemo(() => {
    const list = scoped.filter(s => matchesBeyondScope(s, filters))
    if (filters.sortBy !== 'recent') {
      return list
    }
    const at = (s: SpecEntry) =>
      s.verdict ? new Date(s.verdict.reviewedAt).getTime() : 0
    return [...list].sort((a, b) => at(b) - at(a))
  }, [scoped, filters])

  // The cards on screen are a capture of that query, not the query itself, so
  // approving or denying one never moves, reorders or removes anything: it is
  // the reviewer who decides when a settled card leaves, per card or by the
  // batch.
  const { queue, leaving, pending, refresh, dismiss } = useStickyQueue({
    entries,
    matching,
    viewKey: `${dataEpoch} ${queryKey(filters)}`,
  })

  return (
    <>
      <Header
        filters={filters}
        onChange={changeFilter}
        entries={entries}
        scoped={scoped}
        groups={groups}
        liveLabels={liveLabels}
        settledCount={leaving.size}
        onClearSettled={refresh}
        loading={loading}
        onReload={() => {
          void load()
        }}
      />
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
        <CompareViewProvider mode={filters.compare} onMode={onCompareMode}>
          {queue.map(spec => (
            <Card
              key={spec.name}
              spec={spec}
              message={messages[spec.name]}
              pressed={pressed[spec.name]}
              drafts={drafts}
              liveTarget={liveTarget}
              settled={leaving.has(spec.name)}
              onSetVerdict={setVerdict}
              onClearVerdict={clearVerdict}
              onSaveNote={saveNote}
              onDismiss={dismiss}
            />
          ))}
        </CompareViewProvider>
        {/* The live query selects cards this capture does not hold, which the
            reviewer cannot tell from "nothing left to review": the queue is a
            capture, so it stays as it is until it is retaken. */}
        {!loadError && pending ? (
          <button type="button" className="tab requeue" onClick={refresh}>
            {pending} card{pending === 1 ? '' : 's'} match these filters — load
            {pending === 1 ? ' it' : ' them'}
          </button>
        ) : null}
        {/* …and an empty list under filters that select NOTHING has to say so
            out loud. Bare, `main` renders as blank page, which is what a review
            server that failed to start, a bad bookmark and a finished sweep all
            look like — and only one of those is worth celebrating. */}
        {!loadError && !queue.length && !pending ? (
          <div className="empty">{emptyText(dataEpoch, filters)}</div>
        ) : null}
      </main>
    </>
  )
}
