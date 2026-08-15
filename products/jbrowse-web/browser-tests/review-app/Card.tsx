import { memo } from 'react'

import {
  shownStatus,
  useNoteDraft,
} from '@jbrowse/browser-test-utils/reviewApp'

import { DRIFT_THRESHOLD, maxDrift } from './filters.ts'

import type { SnapshotPayloadEntry } from '../review-snapshot-payload.ts'
import type { Diffs } from './filters.ts'
import type {
  CardMessage,
  DraftStore,
  PressStatus,
} from '@jbrowse/browser-test-utils/reviewApp'

export function Pill({
  cls,
  children,
}: {
  cls: string
  children: React.ReactNode
}) {
  return <span className={`pill ${cls}`}>{children}</span>
}

// -1 is "not comparable", which is a different answer from 0 and has to read
// like one: a snapshot only one backend captured has nothing to drift from.
export function DriftPill({ pct }: { pct: number }) {
  return pct < 0 ? (
    <Pill cls="absent">n/a</Pill>
  ) : pct === 0 ? (
    <Pill cls="ident">identical</Pill>
  ) : (
    <Pill cls={pct < DRIFT_THRESHOLD ? 'drift' : 'bigdrift'}>
      {pct.toFixed(2)}%
    </Pill>
  )
}

export function ImgCol({
  label,
  right,
  children,
}: {
  label: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="imgcol">
      <div className="imglabel">
        <span>{label}</span>
        <span>{right}</span>
      </div>
      <div className="imgwrap">{children}</div>
    </div>
  )
}

// `bust` is the reference snapshot's hash: in the URL, the browser refetches
// exactly when the pixels change and caches otherwise. Without it a test run
// leaves the reviewer judging a cached image while the server hashes the one now
// on disk. Only the reference image (the one the verdict is about) carries it;
// the backend-comparison views are read-only.
export function SnapshotImg({
  loc,
  name,
  bust,
}: {
  loc: string
  name: string
  bust?: string | null
}) {
  const src = `/img/${loc}/${encodeURIComponent(name)}${bust ? `?v=${encodeURIComponent(bust)}` : ''}`
  return (
    <img
      src={src}
      alt={name}
      // Lazy is not an optimization here, it is what lets the page open. There
      // are ~199 snapshots and most are full-page captures; decoded all at once
      // they are on the order of a gigabyte of bitmap, and the renderer dies —
      // which looks like the review tool crashing on startup. The reviewer works
      // down the list, so the ones off screen are ones nobody is looking at yet.
      loading="lazy"
      onClick={e => {
        window.open(e.currentTarget.src)
      }}
    />
  )
}

export interface CardProps {
  entry: SnapshotPayloadEntry
  // Worst pairwise drift %, or undefined while the background pass has not
  // reached this snapshot yet. A number, not the whole diff map: that map is
  // re-parsed every two seconds for ~25s, so passing it would re-render every
  // card on every poll and defeat the memo — while a reviewer is typing.
  drift?: number
  // this snapshot has two or more backend captures, so a drift number is coming
  // — which is what lets the card hold its place before one arrives
  comparable: boolean
  message?: CardMessage
  pressed?: PressStatus
  drafts: DraftStore
  // this card is done with as far as the current filters are concerned, and is
  // only still on screen because taking it away is the reviewer's call
  settled: boolean
  // the note goes with the verdict, and it is the text in this card's box —
  // see useReview for the two ways the report's copy stops matching it
  onSetVerdict: (name: string, status: 'good' | 'bad', note: string) => void
  onClearVerdict: (name: string) => void
  onSaveNote: (name: string, note: string) => void
  onDismiss: (name: string) => void
}

export const Card = memo(function Card({
  entry,
  drift,
  comparable,
  message,
  pressed,
  drafts,
  settled,
  onSetVerdict,
  onClearVerdict,
  onSaveNote,
  onDismiss,
}: CardProps) {
  const note = useNoteDraft({ entry, drafts, onSave: onSaveNote })
  const v = entry.verdict
  const status = v ? v.status : 'none'
  // A verdict is recorded against a hash of the snapshot, so one with no image
  // on disk has nothing to record it against and the server refuses the write —
  // a 400 the reviewer only saw after clicking a button that looked live. Same
  // test as the server's, so the two cannot drift. Clear stays enabled:
  // dropping an entry needs no image.
  const canJudge = !!entry.imageHash
  const shown = shownStatus(entry, pressed)
  const where = [entry.inRoot ? 'root' : null, ...entry.backends]
    .filter(Boolean)
    .join(', ')

  const verdictBtn = (cls: string, label: string, want: 'good' | 'bad') => (
    <button
      type="button"
      className={shown === want ? `${cls} active` : cls}
      disabled={!canJudge}
      title={
        canJudge
          ? undefined
          : 'no image on disk — nothing to record a verdict against'
      }
      onClick={() => {
        onSetVerdict(entry.name, want, note.value)
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      className={`card ${entry.stale ? 'stale' : status}${settled ? ' settled' : ''}`}
    >
      <div className="card-images">
        <ImgCol
          label={entry.refLoc ? `rendered (${entry.refLoc})` : 'rendered'}
        >
          {entry.refLoc ? (
            <SnapshotImg
              loc={entry.refLoc}
              name={entry.name}
              bust={entry.imageHash}
            />
          ) : (
            <div className="missing">⚠ no image on disk</div>
          )}
        </ImgCol>
      </div>
      <div className="meta">
        {/* Nothing in here changes while the page is open, which is the point:
            the title is a wrapping row, and a pill leaving it can drop it from
            two lines to one and take ~22px off everything below — the buttons
            the reviewer is about to press again included. The two pills that DO
            change moved to the reserved row underneath. */}
        <h2>
          {entry.name}
          <Pill cls={entry.kind}>{entry.kind}</Pill>
        </h2>
        {/* Both of these arrive after the card is already on screen and
            clickable: `stale` goes away when the reviewer's own verdict lands,
            and the drift number is filled in by a background pass that walks the
            whole corpus over ~25s. So the row is reserved (app.css) on any card
            that will ever have something to put in it. */}
        {comparable || entry.stale ? (
          <div className="flags">
            {entry.stale ? (
              <Pill cls="stale">image changed since {status}</Pill>
            ) : null}
            {!comparable ? null : drift === undefined ? (
              // Said out loud rather than left blank. Blank is also what "only
              // one backend captured this" looks like, and that one is `n/a`.
              <Pill cls="absent">measuring drift…</Pill>
            ) : (
              <DriftPill pct={drift} />
            )}
          </div>
        ) : null}
        <div className="reviewedAt">present in: {where}</div>
        {/* a textarea, not an input: a denial reason is a paragraph, and
            useNoteDraft grows this one to fit it */}
        <textarea
          className="note"
          ref={note.ref}
          rows={2}
          placeholder="note (optional)"
          value={note.value}
          onChange={note.onChange}
          onFocus={note.onFocus}
          onBlur={note.onBlur}
        />
        <div className="actions">
          {verdictBtn('approve', '✓ Approve', 'good')}
          {verdictBtn('deny', '✗ Deny', 'bad')}
          {/* Disabled rather than absent on an unreviewed snapshot. Rendered
              only when there is a verdict, it appears the instant a write lands
              and pushes everything after it along the row. */}
          <button
            type="button"
            className="clear"
            disabled={!v}
            title={
              v
                ? 'Drop this verdict and its note — the card goes back to unreviewed'
                : 'nothing recorded yet'
            }
            onClick={() => {
              onClearVerdict(entry.name)
            }}
          >
            clear
          </button>
          {/* Always rendered, including on an empty box where it only focuses
              the field: shown only when there is text to preserve, it would
              have to appear and disappear as the note is typed. */}
          <button
            type="button"
            className="addnote"
            title="Keep this note and start a new one above it"
            onClick={note.addNote}
          >
            + add note
          </button>
          {v ? (
            <span className="reviewedAt">
              {new Date(v.reviewedAt).toLocaleString()}
            </span>
          ) : null}
          {/* Appended at the END of the row, never inserted among the verdict
              buttons: this appears the instant a write lands, and a control that
              grows in front of Approve/Deny would move them out from under a
              pointer already on its way to the next click. */}
          {settled ? (
            <button
              type="button"
              className="hide"
              title="Recorded. It only stays on the list so you can still add a note — this takes it off."
              onClick={() => {
                onDismiss(entry.name)
              }}
            >
              done — hide
            </button>
          ) : null}
        </div>
        {/* Below the buttons, not under the box it describes — see app.css for
            what its line reserving is protecting. */}
        <div className="unsaved">{note.hint}</div>
        {message ? (
          <div className={`cardmsg ${message.kind}`}>{message.text}</div>
        ) : null}
      </div>
    </div>
  )
})

// The backends page: the same snapshot as each backend drew it, plus a diff
// thumbnail per comparable pair. Read-only — a verdict is about the reference
// image, and this page is asking a different question.
export const BackendCard = memo(function BackendCard({
  entry,
  diffs,
}: {
  entry: SnapshotPayloadEntry
  diffs: Diffs
}) {
  // flatMap rather than filter, so the percent is computed where the number is
  // known to be one and no later reader has to assert it back
  const pairs = (diffs[entry.name] ?? []).flatMap(p =>
    typeof p.diffFraction === 'number'
      ? [{ a: p.a, b: p.b, pct: p.diffFraction * 100 }]
      : [],
  )
  return (
    <div className="card">
      <div className="card-images">
        {(['canvas2d', 'webgl', 'webgpu'] as const).map(b => (
          <ImgCol key={b} label={b}>
            {entry.backends.includes(b) ? (
              <SnapshotImg loc={b} name={entry.name} />
            ) : (
              <div className="missing">not captured</div>
            )}
          </ImgCol>
        ))}
      </div>
      {pairs.length ? (
        <div className="card-images">
          {pairs.map(p => (
            <ImgCol
              key={`${p.a}-${p.b}`}
              label={`${p.a} vs ${p.b}`}
              right={<DriftPill pct={p.pct} />}
            >
              <img
                src={`/img-diff?name=${encodeURIComponent(entry.name)}&a=${p.a}&b=${p.b}`}
                alt={`${p.a} vs ${p.b}`}
                // same reason as the reference image, and more so: this page
                // draws three backends plus up to three diffs per card, and
                // every diff is a PNG the server renders on demand
                loading="lazy"
                onClick={e => {
                  window.open(e.currentTarget.src)
                }}
              />
            </ImgCol>
          ))}
        </div>
      ) : null}
      <div className="meta">
        <h2>
          {entry.name}
          <Pill cls={entry.kind}>{entry.kind}</Pill>
          <DriftPill pct={maxDrift(diffs, entry.name)} />
        </h2>
      </div>
    </div>
  )
})
