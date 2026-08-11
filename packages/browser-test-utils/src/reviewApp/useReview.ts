import { useCallback, useMemo, useRef, useState } from 'react'

import { DraftStore } from './drafts.ts'
import {
  conflictText,
  postClearVerdict,
  postVerdict,
  queueWrite,
} from './protocol.ts'

import type { Verdict } from '../reviewVerdicts.ts'
import type {
  CardMessage,
  PressStatus,
  ReviewEntry,
  WriteResult,
} from './types.ts'

// The review's state and the four things a reviewer can do to it, shared by both
// review UIs. Each page supplies its own payload type, its own cards and its own
// header; this owns the entries, the per-card write chain and the two pieces of
// bookkeeping that live outside the entries (the outcome message, and the press
// waiting on its write).
//
// ---------------------------------------------------------------------------
// What is NOT here any more, and why
//
// This replaces a client that rendered with `el.outerHTML = renderCard(entry)`.
// That wholesale swap destroyed everything the DOM held and the entries did not
// — the click in flight between a mousedown and its mouseup, the caret in a
// note, the press waiting on its write, unsaved text, the pointer capture on a
// swipe divider — and about half of that client was machinery carrying those
// back across it: a pointerHeld/deferredCards/scheduleFlush deferral, a
// harvest/apply note pair, a repaintUnsafe guard, and a paintCard that restored
// the caret by hand. Two of those workarounds cancelled each other out at least
// once, and every "I have to click Approve twice" report was one of them.
//
// A reconciler keeps node identity and patches props in place, so none of it is
// reachable: the button survives its own click, the textarea keeps its caret,
// and a card repaints without touching the one next to it. If a repaint-shaped
// bug ever appears here, it is a bug — not an invitation to add a guard.
// ---------------------------------------------------------------------------

const noneActed: ReadonlySet<string> = new Set()

export interface UseReviewOptions {
  // localStorage key this tool's note drafts live under
  draftsKey: string
  // how this tool says an image moved on disk under the reviewer, e.g. 'this
  // figure was regenerated'. Reads mid-sentence in the 409 message.
  imageMovedPhrase: string
}

export function useReview<E extends ReviewEntry>({
  draftsKey,
  imageMovedPhrase,
}: UseReviewOptions) {
  const drafts = useMemo(() => new DraftStore(draftsKey), [draftsKey])

  // Entries live in a ref as well as in state. The ref is what a queued write
  // reads: it runs at least a microtask after the click, and by then a note save
  // ahead of it in the queue may have adopted a new reviewedAt — which is the
  // precondition this write has to carry. State drives rendering; the two are
  // written together and never separately.
  const entriesRef = useRef<E[]>([])
  const [entries, setEntriesState] = useState<E[]>([])
  const [messages, setMessages] = useState<Record<string, CardMessage>>({})
  const [pressed, setPressed] = useState<Record<string, PressStatus>>({})
  // Names acted on since the current filter view was entered. They stay visible
  // even once their new verdict no longer matches the filter, so you can still
  // type a reason after clicking Deny in the unreviewed/denied queue.
  //
  // Superseded by useStickyQueue, which holds the whole LIST still rather than
  // exempting the acted-on rows from it — the exemption keeps a card on screen
  // but not in its place, and touching any filter drops every card it was
  // holding. The website's screenshot review is on the queue; the snapshot
  // review still reads this.
  const [justActed, setJustActed] = useState(noneActed)

  const publish = useCallback((next: E[]) => {
    entriesRef.current = next
    setEntriesState(next)
  }, [])

  const loadEntries = useCallback(
    (next: E[]) => {
      publish(next)
      drafts.dropStale(next)
    },
    [drafts, publish],
  )

  const entryOf = useCallback(
    (name: string) => entriesRef.current.find(e => e.name === name),
    [],
  )

  const patch = useCallback(
    (name: string, fields: Partial<ReviewEntry>) => {
      publish(
        entriesRef.current.map(e =>
          e.name === name ? { ...e, ...fields } : e,
        ),
      )
    },
    [publish],
  )

  const setMessage = useCallback(
    (name: string, text?: string, kind?: CardMessage['kind']) => {
      setMessages(m => {
        const next = { ...m }
        if (text) {
          next[name] = { text, kind: kind ?? 'error' }
        } else {
          delete next[name]
        }
        return next
      })
    },
    [],
  )

  // Show the press before the round trip that confirms it. The card is only
  // rebuilt once the server answers, which is ~20ms against an idle server and
  // several hundred while a page load's worth of figures is still streaming down
  // the same six connections — and a button that stays unpressed that long reads
  // as a click that missed, so the reviewer clicks again.
  //
  // It is still only a placeholder: the entry decides what a SETTLED card looks
  // like, including on a failure or a conflict.
  const press = useCallback((name: string, status: PressStatus) => {
    setPressed(p => ({ ...p, [name]: status }))
  }, [])

  // Only the write that carried this press may retire it. A second click before
  // the first write returns leaves the newer press standing, so the card does
  // not flick back through the older verdict on its way to the one the reviewer
  // actually ended on.
  const unpress = useCallback((name: string, status: PressStatus) => {
    setPressed(p => {
      if (p[name] !== status) {
        return p
      }
      const next = { ...p }
      delete next[name]
      return next
    })
  }, [])

  // Take on what the server says is on disk, so the next write carries a
  // precondition that will actually match. Adopting the image hash also swaps
  // the <img> URL, so the render puts the new picture in front of the reviewer
  // instead of leaving the old one cached in place.
  const adopt = useCallback(
    (name: string, result: Extract<WriteResult, { conflict: true }>) => {
      patch(name, {
        verdict: result.current,
        stale: result.stale,
        imageHash: result.imageHash,
      })
    },
    [patch],
  )

  // The draft clears itself once the report holds the same text, and stays put
  // when the write failed — which is the case the reviewer needs it for. Read
  // after the patch, so it is the note the server actually stored.
  const reconcileDraft = useCallback(
    (name: string) => {
      drafts.reconcile(name, entryOf(name)?.verdict?.note ?? '')
    },
    [drafts, entryOf],
  )

  const failed = (err: unknown) =>
    err instanceof Error ? err.message : String(err)

  // `note` is the text in the card's own box at the moment of the click, and it
  // is the caller's to supply because the card is the only thing that knows it.
  // Reconstructing it here instead — draft, else the report's copy — was wrong
  // wherever the report's copy moved out from under the box: clearing a verdict
  // drops the note the box is still showing, and a 409 adopts the other side's.
  // Both then posted a note the reviewer could see was not the one they had.
  const setVerdict = useCallback(
    (name: string, status: Verdict['status'], note: string) => {
      if (!entryOf(name)) {
        return
      }
      press(name, status)
      return queueWrite(name, async () => {
        // Re-read rather than closing over the entry at click time: a note save
        // ahead of us in the queue may have moved its reviewedAt.
        const entry = entryOf(name)
        if (!entry) {
          return
        }
        try {
          const result = await postVerdict(entry, status, note)
          if (result.conflict) {
            adopt(name, result)
            setMessage(name, conflictText(result, imageMovedPhrase), 'warn')
          } else {
            // Adopt the server's own verdict: it carries the reviewedAt the
            // next write has to match and the image hash this tab cannot
            // compute. It was recorded against the current image, so it is not
            // stale.
            patch(name, { verdict: result.body, stale: false })
            setMessage(name)
          }
        } catch (err) {
          setMessage(name, `Not saved — ${failed(err)}`)
        }
        setJustActed(a => new Set(a).add(name))
        reconcileDraft(name)
        unpress(name, status)
      })
    },
    [
      adopt,
      entryOf,
      imageMovedPhrase,
      patch,
      press,
      reconcileDraft,
      setMessage,
      unpress,
    ],
  )

  // Persist note edits on their own so a reason typed after Approve/Deny is
  // saved without needing to click the button again.
  const saveNote = useCallback(
    (name: string, note: string) => {
      if (!entryOf(name)) {
        return
      }
      return queueWrite(name, async () => {
        const entry = entryOf(name)
        if (!entry) {
          return
        }
        if (!entry.verdict) {
          // A note has nothing to attach to until there is a verdict; say so
          // rather than dropping the words silently. An Approve/Deny click is
          // usually right behind us in the queue, and it carries this text
          // along.
          setMessage(
            name,
            'Note not saved yet — approve or deny and it goes with the verdict.',
            'warn',
          )
          return
        }
        try {
          // A note save carries the image precondition too, because the server
          // restamps the verdict's hash from the current image on every write:
          // without it, typing a note would quietly re-bless one that had been
          // rewritten since, and clear its 'changed since review' flag with
          // nobody having looked.
          const result = await postVerdict(entry, entry.verdict.status, note)
          if (result.conflict) {
            adopt(name, result)
            setMessage(
              name,
              `${conflictText(result, imageMovedPhrase)} Your note text is still here — blur again to save it.`,
              'warn',
            )
            return
          }
          // The server restamps the verdict's hash from the image on disk, so a
          // save against an entry that WAS stale has just made it fresh.
          patch(name, { verdict: result.body, stale: false })
          setMessage(name)
        } catch (err) {
          setMessage(name, `Note not saved — ${failed(err)}`)
        }
        reconcileDraft(name)
      })
    },
    [adopt, entryOf, imageMovedPhrase, patch, reconcileDraft, setMessage],
  )

  const clearVerdict = useCallback(
    (name: string) => {
      if (!entryOf(name)) {
        return
      }
      press(name, null)
      return queueWrite(name, async () => {
        const entry = entryOf(name)
        if (!entry) {
          return
        }
        try {
          const result = await postClearVerdict(entry)
          if (result.conflict) {
            adopt(name, result)
            setMessage(name, conflictText(result, imageMovedPhrase), 'warn')
          } else {
            patch(name, { verdict: undefined, stale: false })
            setMessage(name)
          }
        } catch (err) {
          setMessage(name, `Not cleared — ${failed(err)}`)
        }
        unpress(name, null)
      })
    },
    [adopt, entryOf, imageMovedPhrase, patch, press, setMessage, unpress],
  )

  const clearJustActed = useCallback(() => {
    setJustActed(noneActed)
  }, [])

  return {
    entries,
    loadEntries,
    drafts,
    messages,
    pressed,
    justActed,
    clearJustActed,
    setVerdict,
    saveNote,
    clearVerdict,
  }
}
