import type { ReviewEntry } from './types.ts'

// Note text typed but not yet saved, by entry name, outliving the page in
// localStorage.
//
// A note only reaches the server when the field blurs, and on an entry with no
// verdict it never reaches it at all (saveNote has nothing to attach it to), so
// a reload — the one thing a reviewer does constantly, since regenerate/reload/
// look again IS the loop — used to throw away whatever had been typed since the
// last click elsewhere. Whether the words survived came down to whether the
// reviewer happened to click away first, which reads as random.
//
// A plain module singleton rather than React state: the card that owns a name is
// the only thing that reads its draft, and it holds the text in its own state
// while it is mounted. This is what survives the unmount.

export class DraftStore {
  private drafts: Map<string, string>

  // `key` is the localStorage key this tool's drafts live under. Distinct per
  // tool, or two review UIs open side by side would trade drafts for names that
  // mean different pictures in each.
  constructor(private key: string) {
    this.drafts = new Map(this.load())
  }

  private load(): [string, string][] {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(this.key) || '[]')
      return Array.isArray(raw)
        ? (raw.filter(
            e =>
              Array.isArray(e) &&
              typeof e[0] === 'string' &&
              typeof e[1] === 'string',
          ) as [string, string][])
        : []
    } catch {
      // unparseable or unavailable: a lost draft is bad, a review tool that
      // will not open is worse
      return []
    }
  }

  // One write per event-loop turn. A microtask still drains before the page
  // could go anywhere, so nothing typed is at risk in the gap.
  private flush: Promise<void> | undefined

  private save() {
    this.flush ??= Promise.resolve().then(() => {
      this.flush = undefined
      try {
        localStorage.setItem(this.key, JSON.stringify([...this.drafts]))
      } catch {
        // a full or disabled store is not worth failing the review over
      }
    })
  }

  get(name: string) {
    return this.drafts.get(name)
  }

  // The text to send with a write. The draft when there is one, and otherwise
  // whatever the report already holds — which is the whole story, because a
  // draft only exists while it differs from what is saved.
  noteFor(entry: ReviewEntry) {
    return this.drafts.get(entry.name) ?? entry.verdict?.note ?? ''
  }

  // Record what is in the box right now. A draft is only a draft while it
  // differs from what the report holds, so this doubles as the cleanup: the
  // save paths call it with the text they just persisted and it drops itself.
  set(name: string, typed: string, savedNote: string) {
    if (typed === savedNote) {
      this.drafts.delete(name)
    } else {
      this.drafts.set(name, typed)
    }
    this.save()
  }

  // Drop this draft if the report has caught up with it. Called after a write
  // settles, with the note the server actually stored — so a successful save
  // retires the draft, a failed one leaves it exactly where the reviewer needs
  // it, and text typed AFTER the click that is still newer than what landed is
  // kept rather than being mistaken for the saved copy.
  reconcile(name: string, savedNote: string) {
    if (this.drafts.get(name) === savedNote) {
      this.drafts.delete(name)
      this.save()
    }
  }

  // Drop drafts the report has caught up with, and drafts for entries that no
  // longer exist. Without this a note saved in one session comes back as an
  // "unsaved" draft in the next, and deleted entries accumulate in the store
  // forever. Call once the page has its data, since both questions need it.
  dropStale(entries: readonly ReviewEntry[]) {
    const byName = new Map(entries.map(e => [e.name, e]))
    for (const [name, typed] of [...this.drafts]) {
      const entry = byName.get(name)
      if (!entry || typed === (entry.verdict?.note ?? '')) {
        this.drafts.delete(name)
      }
    }
    this.save()
  }
}

// Say plainly whether the words in the box are in the report yet. The two ways
// out differ — an entry with a verdict saves on blur, one without cannot save at
// all until there is a verdict to attach to — and guessing which case you are in
// is what makes a note field feel unreliable.
export function draftHint(entry: ReviewEntry, hasDraft: boolean) {
  return !hasDraft
    ? ''
    : entry.verdict
      ? 'unsaved — click outside the box to save'
      : 'unsaved — approve or deny to save this note'
}
