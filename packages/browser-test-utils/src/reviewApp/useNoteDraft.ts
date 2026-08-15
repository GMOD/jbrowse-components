import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { draftHint } from './drafts.ts'

import type { DraftStore } from './drafts.ts'
import type { ReviewEntry } from './types.ts'

// A denial reason is the one field here that runs long — it is a paragraph
// arguing with a picture — and a fixed two-row box showed only the last line of
// what was being typed, with the rest scrolled out of reach of the eye that
// needed to reread it. Grow the box with its text instead, up to a cap past
// which it scrolls: the note sits under the figure it is about, and a box that
// grew without limit would push that figure off the screen.
const NOTE_MAX_PX = 320

export interface UseNoteDraftOptions {
  entry: ReviewEntry
  drafts: DraftStore
  onSave: (name: string, note: string) => void
}

// The note box for one card: its text, its draft bookkeeping, its height, and
// the "+ add note" restructuring. Returned rather than wrapped in a component
// because the three pieces do not sit together — the box is above the buttons,
// the add-note button is among them, and the unsaved hint is below them all
// (which is where it has to be: it appears the moment you type and disappears
// the moment the note saves, and above the buttons it moved them 27px out from
// under the pointer between a mousedown and its mouseup).
export function useNoteDraft({ entry, drafts, onSave }: UseNoteDraftOptions) {
  const { name } = entry
  const savedNote = entry.verdict?.note ?? ''
  const ref = useRef<HTMLTextAreaElement>(null)
  // Seeded from the draft store, which is what survives a reload — a note only
  // reaches the server on blur, and on an entry with no verdict not even then.
  const [value, setValue] = useState(() => drafts.get(name) ?? savedNote)
  // Bumped by addNote so the layout effect below re-runs and moves the caret,
  // even in the case where the text it produced is the text already there.
  const [caretNonce, setCaretNonce] = useState(0)
  const resetCaret = useRef(false)
  // What `onchange` semantics need: save on blur only if the box changed while
  // it had focus. Without it, focusing a card with a restored draft and
  // clicking away posts a write nobody asked for.
  const atFocus = useRef(value)

  // Empty the box when the verdict goes away. `clear` deletes the whole report
  // entry, note included, so text left behind is text nothing will save: it
  // outlived its verdict in the box alone, unbacked by the draft store, and the
  // next unmount — Clear settled, a filter, a browser reload — took it without
  // saying so. The draft goes with it for the same reason, or a reload would
  // put back what was just cleared.
  //
  // Written for the verdict going away rather than for the button, so a clear
  // that FAILS leaves the note where the reviewer needs it, and a clear another
  // process made — adopted through a 409, or seen on the next load — reads the
  // same as one made here.
  //
  // Adjusted during render, the pattern React documents for state derived from
  // a changed input; the draft write rides along because the two are the same
  // fact and a box emptied without it is the bug above in miniature.
  const [hadVerdict, setHadVerdict] = useState(!!entry.verdict)
  if (hadVerdict !== !!entry.verdict) {
    setHadVerdict(!!entry.verdict)
    if (!entry.verdict) {
      setValue('')
      atFocus.current = ''
      drafts.set(name, '', '')
    }
  }

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    // shrink first: scrollHeight can never report less than the current height,
    // so without this the box only ever grows, including after a deletion
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, NOTE_MAX_PX)}px`
    if (resetCaret.current) {
      resetCaret.current = false
      el.focus()
      // caret above the divider, which is the whole point, and scrollTop with
      // it, because a box at its cap otherwise opens showing the bottom of the
      // old note rather than the empty line the cursor is on
      el.setSelectionRange(0, 0)
      el.scrollTop = 0
    }
  }, [value, caretNonce])

  // Capture the draft on every keystroke. A reload is not a repaint: it fires
  // no blur on the focused note field, so text typed since the last one would
  // have nothing holding it anywhere.
  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)
      drafts.set(name, e.target.value, savedNote)
    },
    [drafts, name, savedNote],
  )

  const onFocus = useCallback(() => {
    atFocus.current = value
  }, [value])

  const onBlur = useCallback(() => {
    if (value !== atFocus.current) {
      atFocus.current = value
      onSave(name, value)
    }
  }, [name, onSave, value])

  // Start a new note without throwing the last one away.
  //
  // The manual version is retyping "the new thing. previous notes: <the old
  // text>" every time, and the friction of that is why the old note usually
  // just gets overwritten instead. That loses the wrong thing: a denial reason
  // is the record of WHY a figure was rejected, and the second look at a figure
  // is exactly when the first look's reasoning is worth having in front of you.
  //
  // Newest on top, because that is the order the reviewer wrote it in and the
  // order a truncated box shows. Repeated adds nest, which is honest: three
  // rounds of review read as three entries rather than as one merged paragraph
  // nobody can date.
  //
  // Nothing is written to the server here, and that is deliberate: a bare
  // "previous notes:" header with nothing above it is not a note. The field
  // goes dirty and saves on blur like any other edit. What IS recorded is the
  // draft, so a reload between clicking this and typing loses nothing.
  const addNote = useCallback(() => {
    const old = value.trim()
    const next = old ? `\n\nprevious notes:\n${old}` : ''
    resetCaret.current = true
    setCaretNonce(n => n + 1)
    setValue(next)
    drafts.set(name, next, savedNote)
  }, [drafts, name, savedNote, value])

  return {
    ref,
    value,
    onChange,
    onFocus,
    onBlur,
    addNote,
    // Whether what is in the box has reached the report yet.
    hint: draftHint(entry, value !== savedNote),
  }
}
