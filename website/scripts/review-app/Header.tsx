import { settledAs } from '@jbrowse/browser-test-utils/reviewApp'

import {
  COMPARE_MODES,
  KINDS,
  KIND_LABELS,
  SORTS,
  SORT_LABELS,
  matchesBeyondScope,
} from './filters.ts'
import { LIVE_WHICH } from './liveLinks.ts'

import type { SpecEntry } from '../review-payload.ts'
import type { Filters, Status } from './filters.ts'
import type { LiveWhich } from './liveLinks.ts'

// The controls, the badges and the progress pills.
//
// Every number here counts something a verdict changes, so each sits in a
// fixed-width slot and each pill is drawn even at zero. See the header rule in
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

// One labelled select, which is the shape of every filter control on this bar.
// Options are [value, what to call it] so the label can be looked up from
// whatever table owns it rather than being spelled out again here.
function Ctrl<T extends string>({
  label,
  title,
  value,
  options,
  onChange,
}: {
  label: string
  title: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (value: T) => void
}) {
  return (
    <label className="ctrl">
      <span>{label}</span>
      <select
        title={title}
        value={value}
        onChange={e => {
          onChange(e.target.value as T)
        }}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

// A header button, with its count in the same slot on all of them. `extra` is
// for the one that carries a class of its own (the flush button, whose width
// app.css reserves while it has nothing to clear).
function Tab({
  active,
  label,
  count,
  title,
  extra,
  disabled,
  onClick,
}: {
  active?: boolean
  label: string
  count?: number
  title?: string
  extra?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`tab${active ? ' active' : ''}${extra ? ` ${extra}` : ''}`}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
      {count === undefined ? null : <Count n={count} />}
    </button>
  )
}

const TABS: { status: Status; label: string }[] = [
  { status: 'needs', label: 'Needs review' },
  { status: 'good', label: 'Approved' },
  { status: 'answered', label: 'Answered' },
  { status: 'bad', label: 'Denied' },
]

export interface HeaderProps {
  filters: Filters
  onChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void
  // every entry, for the progress pills — those read the whole sweep
  entries: SpecEntry[]
  // the entries under the group/kind/search scope, for the badges — those read
  // what clicking a control would show
  scoped: SpecEntry[]
  groups: string[]
  liveLabels: Record<LiveWhich, string>
  // settled and no longer matching, so still on screen only because taking them
  // away is the reviewer's call
  settledCount: number
  onClearSettled: () => void
  loading: boolean
  onReload: () => void
}

export function Header({
  filters,
  onChange,
  entries,
  scoped,
  groups,
  liveLabels,
  settledCount,
  onClearSettled,
  loading,
  onReload,
}: HeaderProps) {
  // A badge answers "how many cards do I get if I click this", so it counts
  // within the group/kind/search scope and under every OTHER control's current
  // setting, replacing only its own. A global 42 above a filtered view showing 3
  // reads as a broken filter — and the three hand-written versions of this
  // disagreed in the other direction, 'Changed vs main' reading 40 over a
  // needs-review queue that would show 3.
  const badge = (over: Partial<Filters>) =>
    scoped.filter(s => matchesBeyondScope(s, { ...filters, ...over })).length

  // The pill row stays global: that one is the progress reading for the whole
  // sweep, not a preview of what a control would show.
  const settled = (status: 'good' | 'bad' | 'answered') =>
    entries.filter(s => settledAs(s, status)).length

  return (
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
          onChange('q', e.target.value)
        }}
      />
      <Ctrl
        label="Group"
        title="Filter by name group"
        value={filters.group}
        options={[
          ['', 'All groups'] as const,
          ...groups.map(g => [g, g] as const),
        ]}
        onChange={v => {
          onChange('group', v)
        }}
      />
      <Ctrl
        label="Kind"
        title="Filter by how the image is produced"
        value={filters.kind}
        options={KINDS.map(k => [k, KIND_LABELS[k]] as const)}
        onChange={v => {
          onChange('kind', v)
        }}
      />
      <Ctrl
        label="Compare"
        title="How each card shows the current image against origin/main"
        value={filters.compare}
        options={COMPARE_MODES.map(([id, , , label]) => [id, label] as const)}
        onChange={v => {
          onChange('compare', v)
        }}
      />
      <Ctrl
        label="Sort"
        title="Sort order"
        value={filters.sortBy}
        options={SORTS.map(s => [s, SORT_LABELS[s]] as const)}
        onChange={v => {
          onChange('sortBy', v)
        }}
      />
      {/* A figure under review is routinely of a change the hosted build does
          not have yet, so the link under it opens a different app from the one
          the picture came out of. This is how it gets pointed at the app that
          did produce it. */}
      <Ctrl
        label="Live links"
        title="Which app a card's Open live link opens the captured session in — the hosted build, or a jbrowse-web dev server on this machine (pnpm start in products/jbrowse-web; --app-port if it is not on 3000)"
        value={filters.live}
        options={LIVE_WHICH.map(w => [w, liveLabels[w]] as const)}
        onChange={v => {
          onChange('live', v)
        }}
      />
      <div className="tabs">
        {TABS.map(t => (
          <Tab
            key={t.status}
            active={filters.status === t.status}
            label={t.label}
            count={badge({ status: t.status })}
            onClick={() => {
              onChange('status', t.status)
            }}
          />
        ))}
        <Tab
          active={filters.status === 'all'}
          label="All"
          onClick={() => {
            onChange('status', 'all')
          }}
        />
      </div>
      <Tab
        active={filters.changedOnly}
        label="Changed vs main"
        title="only screenshots new or changed vs origin/main"
        count={badge({ changedOnly: true })}
        onClick={() => {
          onChange('changedOnly', !filters.changedOnly)
        }}
      />
      <Tab
        active={filters.runOnly}
        label="Render problems"
        title="only specs the last run failed to render, rendered differently twice, or kept behind a raised diffThreshold"
        count={badge({ runOnly: true })}
        onClick={() => {
          onChange('runOnly', !filters.runOnly)
        }}
      />
      {/* The one control that removes cards from the list, so that removing
          them is something the reviewer does rather than something that happens
          to them mid-note. Invisible until there is something to clear, which
          also makes it the progress readout for the batch in front of you — the
          pill row to its right counts the whole sweep. */}
      <Tab
        extra={settledCount ? 'flush' : 'flush reserved'}
        label="Clear settled"
        title="These are settled and no longer match the filters — take them off the list"
        count={settledCount}
        onClick={onClearSettled}
      />
      {/* Fixed label and no count, per the header rule above: `disabled` is the
          whole of the in-flight state because it recolours without resizing, and
          a spinner or a "Reloading…" would move every figure on the page the
          moment the request went out. */}
      <Tab
        label="Reload figures"
        title="Re-read the figures on disk without reloading the page — after a regen, this is the thing to press"
        disabled={loading}
        onClick={onReload}
      />
      <div className="counts">
        <CountPill cls="good" n={settled('good')} label="approved" />
        <CountPill cls="bad" n={settled('bad')} label="denied" />
        <CountPill
          cls="answered"
          n={settled('answered')}
          label="answered, awaiting you"
        />
        <CountPill
          cls="stale"
          n={entries.filter(s => s.stale).length}
          label="changed since review"
        />
        <CountPill
          cls="none"
          n={entries.filter(s => !s.verdict).length}
          label="unreviewed"
        />
      </div>
    </header>
  )
}
