import type { FigureState, RunSummary } from '../review-payload.ts'
import type { BaselineState } from '../screenshot-review-lib.ts'

// Whether the figures on this disk are the figures everyone else gets.
//
// This says so in both directions on purpose. A reviewer approving a figure is
// approving pixels, and since figure bytes are gitignored there is otherwise
// nothing on screen distinguishing "published" from "only exists here" — the old
// world had `git status` for that. A silent banner would leave the good case
// indistinguishable from a banner that failed to render.

function agoText(iso: string) {
  const hours = (Date.now() - new Date(iso).getTime()) / 3600000
  return hours < 1
    ? 'less than an hour ago'
    : hours < 48
      ? `${Math.round(hours)}h ago`
      : `${Math.round(hours / 24)} days ago`
}

// Which origin/main every "new" and "changed" pill on this page is against.
//
// Two things only git knows and the cards cannot show. First, whether there is a
// baseline at all: with no figures.lock at the ref, every figure reads "new" and
// "Changed vs main" selects all of them — which looks exactly like a branch that
// added everything, and was the shape of the bug this page had for months.
// Second, how old it is: a remote-tracking ref is only as fresh as the last
// fetch, so an unfetched checkout compares against a baseline that still calls
// itself main.
function Baseline({ b }: { b: BaselineState }) {
  if (!b.found) {
    return (
      <div className="storeline">
        <strong>
          No <code>figures.lock</code> at <code>{b.ref}</code>, so there is no
          baseline.
        </strong>{' '}
        Every figure below is drawn as new and <em>Changed vs main</em> selects
        all of them — that is this page having nothing to compare against, not a
        fact about your branch. <code>git fetch origin</code>.
      </div>
    )
  }
  return (
    <div className="storeline">
      Compared against <code>{b.ref}</code>
      {b.commit ? (
        <>
          {' at '}
          <code>{b.commit}</code>
          {b.date ? `, ${agoText(b.date)}` : ''}
        </>
      ) : null}{' '}
      — {b.figures} figures. It is only as fresh as your last{' '}
      <code>git fetch</code>.
    </div>
  )
}

// The last sweep, in one line. Says when, because a week-old run describes a
// week-old app; says what it covered, because a narrowed run is silent about
// everything else; and says whether flakiness was even tested for, since only
// --check can answer that and "0 flaky" from a normal run means "not measured".
//
// Scope is read off `selected`, the count of specs the run actually reached, and
// NOT off `filter`. --affected and --cover narrow just as hard as --filter while
// leaving `filter` empty, so the line called a 14-spec run "a full sweep".
function Run({ r }: { r?: RunSummary }) {
  if (!r) {
    return (
      <div className="storeline">
        No sweep has run on this machine, so no figure here carries a render
        verdict. <code>pnpm screenshots</code> writes one.
      </div>
    )
  }
  const named = r.filter.length ? (
    <>
      , filtered to <code>{r.filter.join(',')}</code>
    </>
  ) : null
  // Both counts are needed to call it a sweep. A report that recorded selected
  // but not total compares against 0 and reads as full, which is the same wrong
  // direction filter was standing in for.
  const scope =
    !r.selected || !r.total ? (
      'scope not recorded (it predates this page asking)'
    ) : r.selected >= r.total ? (
      <>a full sweep{named}</>
    ) : (
      <>
        {r.selected} of {r.total} spec(s){named} — the rest carry no verdict
        from it
      </>
    )
  return (
    <div className="storeline">
      Last run {agoText(r.finishedAt)}, {scope}.{' '}
      {r.skipped ? (
        <>
          {r.skipped} selected spec(s) were skipped (curated / heavy remote data
          / needs a GPU).{' '}
        </>
      ) : null}
      {r.failed ? (
        <>
          <strong>{r.failed} spec(s) failed to render</strong> — their cards
          show the last image that worked.{' '}
        </>
      ) : null}
      {r.check ? (
        `${r.flaky} nondeterministic.`
      ) : (
        <>
          Nondeterminism not measured (only <code>--check</code> tests for it).
        </>
      )}
    </div>
  )
}

function Names({ names }: { names: string[] }) {
  return <div className="names">{names.join(', ')}</div>
}

export function StoreBanner({
  state,
  error,
}: {
  state?: FigureState
  error?: string
}) {
  if (error) {
    return (
      <div id="store" className="pending">
        Could not read the figure store state: {error}
      </div>
    )
  }
  if (!state) {
    return <div id="store" />
  }
  const pending =
    !!state.unpublished.length ||
    !!state.unpulled.length ||
    !state.baseline.found ||
    !!state.run?.failed
  return (
    <div id="store" className={pending ? 'pending' : 'ok'}>
      {state.unpublished.length ? (
        <div className="storeline">
          <strong>
            {state.unpublished.length} figure(s) exist only on this machine.
          </strong>{' '}
          Run <code>pnpm figures:push</code> and commit{' '}
          <code>figures.lock</code>, or they are silently dropped — a verdict
          recorded now is against pixels nobody else will see.
          <Names names={state.unpublished} />
        </div>
      ) : (
        <div className="storeline">
          All {state.total} figures are published to the store — what you see
          here is what everyone gets.
        </div>
      )}
      {/* The mirror image of that, and just as invisible to git: figures.lock
          names a figure whose bytes were never fetched here. Those cards have no
          picture at all, which reads as a broken figure rather than an
          unfinished pull. */}
      {state.unpulled.length ? (
        <div className="storeline">
          <strong>
            {state.unpulled.length} figure(s) in <code>figures.lock</code> are
            not on this disk.
          </strong>{' '}
          Run <code>pnpm figures:pull</code> — their cards are blank until you
          do.
          <Names names={state.unpulled} />
        </div>
      ) : null}
      <Baseline b={state.baseline} />
      <Run r={state.run} />
    </div>
  )
}
