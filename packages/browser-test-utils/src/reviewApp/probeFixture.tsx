import { useEffect } from 'react'

import { createRoot } from 'react-dom/client'

import { shownStatus } from './protocol.ts'
import { useNoteDraft } from './useNoteDraft.ts'
import { useReview } from './useReview.ts'

import type { DraftStore } from './drafts.ts'
import type { PressStatus, ReviewEntry } from './types.ts'

// The smallest page the shared review client can drive: one card, two verdict
// buttons, a note, and a message box. It exists for reviewAppProbe.ts, which
// runs it in a real browser against a stubbed fetch — the three properties it
// asserts all live in the gap between a mousedown and a write returning, and
// nothing jest can reach observes them.
//
// Deliberately not the website's card: those three properties are the shared
// client's, and a fixture that also had to be a screenshot review would fail for
// reasons that are not about them.

const ENTRY: ReviewEntry = { name: 'x', stale: false, imageHash: 'h' }

function Probe() {
  const {
    entries,
    loadEntries,
    drafts,
    messages,
    pressed,
    setVerdict,
    saveNote,
  } = useReview<ReviewEntry>({
    draftsKey: 'review-app-probe',
    imageMovedPhrase: 'it moved',
  })
  // one-shot seed; the probe never reloads
  useEffect(() => {
    loadEntries([ENTRY])
  }, [loadEntries])
  const entry = entries[0]
  if (!entry) {
    return null
  }
  return (
    <Card
      entry={entry}
      message={messages[entry.name]?.text ?? ''}
      pressed={pressed[entry.name]}
      drafts={drafts}
      onSetVerdict={setVerdict}
      onSaveNote={saveNote}
    />
  )
}

function Card({
  entry,
  message,
  pressed,
  drafts,
  onSetVerdict,
  onSaveNote,
}: {
  entry: ReviewEntry
  message: string
  pressed: PressStatus | undefined
  drafts: DraftStore
  onSetVerdict: (name: string, status: 'good' | 'bad', note: string) => void
  onSaveNote: (name: string, note: string) => void
}) {
  const note = useNoteDraft({ entry, drafts, onSave: onSaveNote })
  const shown = shownStatus(entry, pressed)
  return (
    <div className="card">
      <button
        type="button"
        className={shown === 'good' ? 'approve active' : 'approve'}
        onClick={() => {
          onSetVerdict(entry.name, 'good', note.value)
        }}
      >
        A
      </button>
      <button
        type="button"
        className={shown === 'bad' ? 'deny active' : 'deny'}
        onClick={() => {
          onSetVerdict(entry.name, 'bad', note.value)
        }}
      >
        D
      </button>
      <textarea
        className="note"
        ref={note.ref}
        value={note.value}
        onChange={note.onChange}
        onFocus={note.onFocus}
        onBlur={note.onBlur}
      />
      <span className="unsaved">{note.hint}</span>
      <div className="cardmsg">{message}</div>
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<Probe />)
}
