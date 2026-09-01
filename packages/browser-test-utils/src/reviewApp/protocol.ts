import type { Verdict } from '../reviewVerdicts.ts'
import type { PressStatus, ReviewEntry, WriteResult } from './types.ts'

// The write protocol as the page speaks it: two endpoints, two preconditions,
// and the recovery rules for a 409. Its server counterpart is reviewServer.ts.
//
// Deliberately framework-free — nothing here imports React. It is the half of
// the string-emitting client this replaced that was never the problem: real
// domain logic, subtle enough (serialize writes per card, adopt what the server
// reports on a 409, never let a failed write look like one that landed) that a
// second copy of it is a second place for it to drift. It has had one: the same
// note-loss bug was once fixed in both review pages in one commit, twice.

// What to put in front of a reviewer when a fetch or a write throws: a dropped
// connection arrives as an Error, a rejected promise from anywhere else can be
// anything at all, and neither is worth a second copy of this in every caller.
export const errorText = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

// What this tab had in hand, sent with every write so the server can reject one
// composed against state that has since moved. null means "there was none",
// which is a precondition worth stating too: it catches a tab that would
// otherwise resurrect an entry another process deleted.
const precondition = (entry: ReviewEntry) => entry.verdict?.reviewedAt ?? null
const imgPrecondition = (entry: ReviewEntry) => entry.imageHash || null

// Never let a write that did not land look like one that did. Throws on
// failure; returns a `conflict: true` result when the server refused because
// the entry changed underneath us.
async function readWriteResponse(res: Response): Promise<WriteResult> {
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  if (res.status === 409) {
    return {
      conflict: true,
      reason: body?.reason === 'image' ? 'image' : 'verdict',
      current: (body?.current as Verdict | null) ?? undefined,
      stale: !!body?.stale,
      imageHash: (body?.imageHash as string | null) ?? null,
    }
  }
  if (!res.ok) {
    throw new Error((body?.error as string) || `HTTP ${res.status}`)
  }
  return { conflict: false, body: (body ?? undefined) as Verdict | undefined }
}

async function postJson(url: string, payload: unknown) {
  return readWriteResponse(
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}

export function postVerdict(
  entry: ReviewEntry,
  status: Verdict['status'],
  note: string,
  endpoint = '/api/verdict',
) {
  return postJson(endpoint, {
    name: entry.name,
    status,
    note,
    ifReviewedAt: precondition(entry),
    ifImageHash: imgPrecondition(entry),
  })
}

export function postClearVerdict(
  entry: ReviewEntry,
  endpoint = '/api/verdict',
) {
  return postJson(`${endpoint}/clear`, {
    name: entry.name,
    ifReviewedAt: precondition(entry),
  })
}

// `imageMovedPhrase` is how this tool says an image moved on disk under the
// reviewer, e.g. 'this figure was regenerated'. It reads mid-sentence.
export function conflictText(
  result: Extract<WriteResult, { conflict: true }>,
  imageMovedPhrase: string,
) {
  return result.reason === 'image'
    ? `Not saved — ${imageMovedPhrase} since the page loaded, so the image you ` +
        'just judged is not the one on disk. The new one is above; look again ' +
        'before deciding.'
    : 'Not saved — this entry changed elsewhere since the page loaded (now: ' +
        `${result.current ? result.current.status : 'cleared'}). The card is ` +
        'back in sync; act again if you still want to.'
}

// A verdict that still describes the image on the card. A stale one names a
// picture that has since been replaced, so it counts as neither approved nor
// denied — it is back in the queue. Shared because every tab badge, filter
// predicate and progress pill asks it, and writing it out longhand is a chance
// for one of them to forget the staleness half and count a verdict the reviewer
// has already been asked to redo.
export const settledAs = (entry: ReviewEntry, status: Verdict['status']) =>
  entry.verdict?.status === status && !entry.stale

// Writes for one card run one after another. Clicking Approve while the note
// field has focus fires that field's change event first — the blur is part of
// the click — so two writes for the same card are issued back to back.
// Unserialized, the second still carries the reviewedAt the first has already
// replaced, and the server refuses it as a conflict with a change that was us:
// the reviewer's Approve silently does not land and the card says the entry
// moved elsewhere.
//
// Module-level rather than per-component, so a card filtered out and back mid
// write does not start a second chain against the first one still running.
const writeChain = new Map<string, Promise<void>>()

export function queueWrite(name: string, fn: () => Promise<void>) {
  const run = (writeChain.get(name) ?? Promise.resolve()).then(fn)
  // Each caller reports its own failure in the card's own message box, so the
  // promise itself carries nothing anyone reads. Swallow once, here, which is
  // also what keeps the chain alive past a failed write.
  const settled = run.catch(() => {})
  writeChain.set(name, settled)
  return settled
}

// Which verdict button a card should be showing as pressed. A press in flight
// wins, because it is the reviewer's click and the round trip confirming it has
// not come back yet; otherwise the entry decides. `undefined` means nothing is
// in flight, which is why a clear is held as `null` rather than as an absence.
export const shownStatus = (
  entry: ReviewEntry,
  inFlight: PressStatus | undefined,
) => (inFlight !== undefined ? inFlight : (entry.verdict?.status ?? null))
