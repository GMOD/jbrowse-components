import { memo, useState } from 'react'

import {
  shownStatus,
  useNoteDraft,
} from '@jbrowse/browser-test-utils/reviewApp'

import { Compare } from './Compare.tsx'
import { isChanged, isNew, partsAhead } from './filters.ts'
import { liveHref, linkHost } from './liveLinks.ts'

import type { SpecEntry } from '../review-payload.ts'
import type { LiveTarget } from './liveLinks.ts'
import type {
  CardMessage,
  DraftStore,
  PressStatus,
} from '@jbrowse/browser-test-utils/reviewApp'

function Pill({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`pill ${cls}`}>{children}</span>
}

// What the last sweep had to say about this spec.
//
// The failure pill matters most: when a spec dies, the PNG on the card is
// whatever the last SUCCESSFUL run left behind, and nothing else on screen
// distinguishes that from a current figure. A reviewer could approve a figure
// the app stopped being able to produce.
//
// "not covered" is drawn rather than left blank, because blank reads as fine. It
// means the last run never reached this spec, so the card carries no evidence
// either way.
function RunPills({ spec }: { spec: SpecEntry }) {
  const r = spec.run
  if (!r) {
    return spec.notCovered ? (
      <Pill cls="notcovered">not in the last run</Pill>
    ) : null
  }
  const pct = (frac: number) => `${(frac * 100).toFixed(2)}%`
  return (
    <>
      {r.skipped ? <Pill cls="notcovered">skipped — {r.skipped}</Pill> : null}
      {r.failed ? <Pill cls="failed">✗ failed to render</Pill> : null}
      {r.flaky !== undefined ? (
        <Pill cls="flaky">
          nondeterministic — {pct(r.flaky)} between two renders
        </Pill>
      ) : null}
      {r.suppressed !== undefined ? (
        <Pill cls="flaky">
          kept behind a raised diffThreshold ({pct(r.suppressed)})
        </Pill>
      ) : null}
    </>
  )
}

// The session the figure was captured from, in whichever app the header's Live
// links control names. The tooltip says which one it reached: the control is one
// setting for the whole page, and a card whose live URL cannot follow it — a
// spec pointing at a site of its own, which has no local equivalent — would
// otherwise silently open somewhere else.
function LiveLink({
  url,
  liveTarget,
  className,
  children,
}: {
  url: string
  liveTarget?: LiveTarget
  className?: string
  children: React.ReactNode
}) {
  const href = liveHref(url, liveTarget)
  return (
    <a
      className={className}
      href={href}
      title={`opens on ${linkHost(href)}`}
      target="_blank"
      rel="noopener"
    >
      {children}
    </a>
  )
}

function Usages({ spec }: { spec: SpecEntry }) {
  return spec.usages.length ? (
    <div className="usages">
      {spec.usages.map(u => (
        <div className="usage" key={`${u.file}:${u.line}`}>
          <div className="loc">
            {u.file}:{u.line}
          </div>
          {u.caption ? <div className="caption">{u.caption}</div> : null}
        </div>
      ))}
    </div>
  ) : (
    <div className="noref">
      ⚠ not referenced in any doc / blog / gallery page
    </div>
  )
}

// A compose figure's parts are its ingredients, not figures of their own: the
// card above already shows the stack they add up to, so they render as a list of
// live links (what <Figure links=...> publishes) rather than separate cards.
function Parts({
  spec,
  liveTarget,
}: {
  spec: SpecEntry
  liveTarget?: LiveTarget
}) {
  if (!spec.parts.length) {
    return null
  }
  return (
    <div className="parts">
      <div className="partshead">stacked from</div>
      {spec.parts.map(p => (
        <div className="part" key={p.name}>
          <span className="partname">{p.name}</span>
          {p.exists ? null : (
            <Pill cls="bad">{p.unpulled ? 'not pulled' : 'image missing'}</Pill>
          )}
          {isNew(p) ? <Pill cls="new">new</Pill> : null}
          {p.changed ? <Pill cls="changed">changed</Pill> : null}
          {p.liveUrl ? (
            <LiveLink url={p.liveUrl} liveTarget={liveTarget}>
              open live ↗
            </LiveLink>
          ) : null}
        </div>
      ))}
      {partsAhead(spec) ? (
        <div className="partstale">
          ⚠ a part changed but the stacked image did not — rerun{' '}
          <code>generate-screenshots --filter {spec.name}</code>
        </div>
      ) : null}
    </div>
  )
}

export interface CardProps {
  spec: SpecEntry
  message?: CardMessage
  pressed?: PressStatus
  drafts: DraftStore
  // which app the live links open in — undefined is the hosted build they were
  // built against
  liveTarget?: LiveTarget
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
  spec,
  message,
  pressed,
  drafts,
  liveTarget,
  settled,
  onSetVerdict,
  onClearVerdict,
  onSaveNote,
  onDismiss,
}: CardProps) {
  const note = useNoteDraft({ entry: spec, drafts, onSave: onSaveNote })
  const v = spec.verdict
  const status = v ? v.status : 'none'
  // A verdict is recorded against a hash of the image, so a card with no image
  // on disk has nothing to record one against and the server refuses it —
  // correctly, but only after the click, as an error message under a button that
  // looked live. Same test as the server's, so the two cannot drift. Clear stays
  // enabled: dropping an entry needs no image.
  const canJudge = !!spec.imageHash
  // A press in flight wins over the entry, so the button is lit for the whole
  // round trip rather than for the frame after the server answers.
  const shown = shownStatus(spec, pressed)

  // The two flags a verdict of the reviewer's own can clear. They get a row of
  // their own, with its height reserved, because among the name's pills they
  // could unwrap the h2 when one went away — and a title line that drops from
  // two rows to one takes ~24px off everything below it, the Approve/Deny
  // buttons included. The reviewer's second click then lands where the button
  // used to be and the browser dispatches no click at all, which is the "I had
  // to press Deny twice" report.
  //
  // Latched on rather than always drawn: the row costs a line, and a card that
  // has never carried a flag has none to lose. Adjusted during render, the
  // pattern React documents for state derived from a changed input — see
  // useStickyQueue for the same shape.
  const flagged = spec.stale || status === 'answered'
  const [everFlagged, setEverFlagged] = useState(flagged)
  if (flagged && !everFlagged) {
    setEverFlagged(true)
  }

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
        onSetVerdict(spec.name, want, note.value)
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      className={`card ${spec.stale ? 'stale' : status}${settled ? ' settled' : ''}`}
    >
      <Compare spec={spec} />
      <div className="meta">
        <h2>
          {spec.name}
          <Pill cls={spec.autogenerated ? 'auto' : 'manual'}>
            {spec.autogenerated ? 'autogenerated' : 'manual'}
          </Pill>
          {isNew(spec) ? <Pill cls="new">new</Pill> : null}
          {isChanged(spec) ? <Pill cls="changed">changed</Pill> : null}
          {spec.unpublished ? (
            <Pill cls="unpublished">not pushed to the store</Pill>
          ) : null}
          <RunPills spec={spec} />
        </h2>
        {everFlagged ? (
          <div className="flags">
            {status === 'answered' ? (
              <Pill cls="answered">answered — reply in the note</Pill>
            ) : null}
            {spec.stale ? (
              <Pill cls="stale">image changed since {status}</Pill>
            ) : null}
          </div>
        ) : null}
        {spec.run?.failed ? (
          <pre className="runerr">{spec.run.failed}</pre>
        ) : null}
        <Usages spec={spec} />
        <Parts spec={spec} liveTarget={liveTarget} />
        {spec.liveUrl ? (
          <LiveLink
            className="livelink"
            url={spec.liveUrl}
            liveTarget={liveTarget}
          >
            Open live in JBrowse ↗
          </LiveLink>
        ) : null}
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
          {/* Disabled rather than absent on an unreviewed card. Rendered only
              when there is a verdict, it appears the instant a write lands and
              pushes everything after it along the row — the same insertion the
              hide button was moved to the end to avoid. */}
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
              onClearVerdict(spec.name)
            }}
          >
            clear
          </button>
          {/* Always rendered, including on an empty box where it only focuses
              the field. Showing it only once there is text to preserve would
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
                onDismiss(spec.name)
              }}
            >
              done — hide
            </button>
          ) : null}
        </div>
        {/* Below the buttons, not under the box it describes: this line appears
            the moment you type and disappears the moment the note saves, and the
            note saves on the blur that the Approve/Deny mousedown itself causes.
            Above the buttons it moved them 27px out from under the pointer
            between mousedown and mouseup. */}
        <div className="unsaved">{note.hint}</div>
        {message ? (
          <div className={`cardmsg ${message.kind}`}>{message.text}</div>
        ) : null}
      </div>
    </div>
  )
})
