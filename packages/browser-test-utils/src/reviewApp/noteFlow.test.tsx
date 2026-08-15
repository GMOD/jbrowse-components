import { useEffect } from 'react'

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { useNoteDraft } from './useNoteDraft.ts'
import { useReview } from './useReview.ts'

import type { DraftStore } from './drafts.ts'
import type { ReviewEntry } from './types.ts'

// What a verdict carries with it. The note the reviewer can SEE is the one that
// has to ride along with Approve/Deny — the card's own text, not a guess
// reconstructed from somewhere else, because a 409 the server won moves the
// report's copy out from under the box and the reviewer is looking at the box.
//
// And when the report's copy goes away entirely, the box goes with it: a clear
// deletes the entry, note included, in both the report and the draft store.

const ENTRY: ReviewEntry = { name: 'x', stale: false, imageHash: 'h' }

interface Posted {
  url: string
  body: { name: string; status?: string; note?: string }
}

function Harness() {
  const { entries, loadEntries, drafts, setVerdict, saveNote, clearVerdict } =
    useReview<ReviewEntry>({
      // one key across a remount, so the drafts a reload would restore are the
      // drafts the last render left behind
      draftsKey: 'drafts',
      imageMovedPhrase: 'it moved',
    })
  useEffect(() => {
    loadEntries([ENTRY])
  }, [loadEntries])
  const entry = entries[0]
  return entry ? (
    <Card
      entry={entry}
      drafts={drafts}
      onSetVerdict={setVerdict}
      onSaveNote={saveNote}
      onClearVerdict={clearVerdict}
    />
  ) : null
}

function Card({
  entry,
  drafts,
  onSetVerdict,
  onSaveNote,
  onClearVerdict,
}: {
  entry: ReviewEntry
  drafts: DraftStore
  onSetVerdict: (name: string, status: 'good' | 'bad', note: string) => void
  onSaveNote: (name: string, note: string) => void
  onClearVerdict: (name: string) => void
}) {
  const note = useNoteDraft({ entry, drafts, onSave: onSaveNote })
  return (
    <div>
      <textarea
        aria-label="note"
        ref={note.ref}
        value={note.value}
        onChange={note.onChange}
        onFocus={note.onFocus}
        onBlur={note.onBlur}
      />
      <button
        type="button"
        onClick={() => {
          onSetVerdict(entry.name, 'good', note.value)
        }}
      >
        approve
      </button>
      <button
        type="button"
        onClick={() => {
          onClearVerdict(entry.name)
        }}
      >
        clear
      </button>
    </div>
  )
}

function setup() {
  const posted: Posted[] = []
  let seq = 0
  fetchMock.mockResponse(async req => {
    const body = JSON.parse(await req.text()) as Posted['body']
    posted.push({ url: req.url, body })
    return req.url.endsWith('/clear')
      ? JSON.stringify({ name: body.name, cleared: true })
      : JSON.stringify({
          name: body.name,
          status: body.status,
          note: body.note,
          reviewedAt: `T${++seq}`,
          hash: 'h',
        })
  })
  render(<Harness />)
  return posted
}

const noteBox = () => screen.getByLabelText('note') as HTMLTextAreaElement
const type = (text: string) => {
  fireEvent.change(noteBox(), { target: { value: text } })
}
const click = async (label: string) => {
  fireEvent.click(screen.getByText(label))
  // the write is queued a microtask behind the click, and its response another
  await act(async () => {})
  await act(async () => {})
}

beforeEach(() => {
  localStorage.clear()
  fetchMock.resetMocks()
})

test('a note typed before the first verdict goes with it', async () => {
  const posted = setup()
  type('the labels overlap')
  await click('approve')
  expect(posted.at(-1)?.body).toMatchObject({
    status: 'good',
    note: 'the labels overlap',
  })
})

test('clearing a verdict empties the note it was attached to', async () => {
  const posted = setup()
  type('the labels overlap')
  await click('approve')
  await click('clear')
  // the clear deleted the report entry, note and all, so a box still showing
  // the reason would be showing something nothing anywhere holds
  expect(noteBox().value).toBe('')
  await click('approve')
  expect(posted.at(-1)?.body).toMatchObject({ status: 'good', note: '' })
})

test('a cleared note does not come back from the draft store', async () => {
  setup()
  type('the labels overlap')
  await click('approve')
  // typed after the save, so the draft store is holding it when the clear lands
  type('and the axis is cut off')
  await click('clear')
  expect(noteBox().value).toBe('')
  cleanup()
  setup()
  expect(noteBox().value).toBe('')
})
