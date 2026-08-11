import { useCallback, useMemo, useState } from 'react'

// The list of cards a reviewer is working, held still while they work it.
//
// A review list is a live query — "everything that still needs review" — and
// reviewing a card is precisely what makes it stop matching. Rendered straight
// off the query, the card you just denied leaves the page before you can type
// why, and everything below slides up into the hole; under 'recently reviewed'
// it teleports to the top instead, which reads worse still, because a card that
// moved 2000px looks like a card that vanished. Either way the reviewer's own
// action is what moves the thing they are still looking at.
//
// So the answer is captured at the moment the reviewer ASKS the question — they
// changed a filter, the data arrived, they hit refresh — and the list on screen
// is that capture. A verdict after it changes how a card LOOKS and never which
// cards are present. The ones that would have dropped out come back as
// `leaving`, so the page can say "these are done" and offer to clear them,
// rather than the list quietly editing itself.
//
// `viewKey` is the question. Fold into it every filter that selects or orders
// (NOT a display-only control like a compare mode: changing how a card draws is
// not asking for a different list) and a counter that changes when new data is
// loaded — with an empty list on the first render, nothing else tells the hook
// that the answer it captured was "nothing, the fetch hasn't landed".

export interface StickyQueue<E> {
  // what to render, in the order it was captured
  queue: E[]
  // names in `queue` the live query no longer selects — settled, still on screen
  leaving: ReadonlySet<string>
  // capture the live query again: everything in `leaving` goes
  refresh: () => void
  // drop one card, for a reviewer done with that one but not with the batch
  dismiss: (name: string) => void
}

export function useStickyQueue<E extends { name: string }>({
  entries,
  matching,
  viewKey,
}: {
  // every entry, so a captured name still resolves to a live card after its
  // verdict has taken it out of `matching`
  entries: E[]
  // what the current filters select right now
  matching: E[]
  // identifies the question the reviewer asked; a change re-captures
  viewKey: string
}): StickyQueue<E> {
  const [pinned, setPinned] = useState(() => ({
    key: viewKey,
    names: matching.map(e => e.name),
  }))

  // Adjusted during render rather than in an effect, the pattern React documents
  // for state derived from a changed input: an effect paints the previous
  // question's answer under the new controls for a frame first, and here that
  // frame is a full list of cards.
  if (pinned.key !== viewKey) {
    setPinned({ key: viewKey, names: matching.map(e => e.name) })
  }
  // This render is the one React is about to throw away when the branch above
  // fired, so it only has to be harmless — but reading the new answer keeps it
  // honest either way.
  const names =
    pinned.key === viewKey ? pinned.names : matching.map(e => e.name)

  const byName = useMemo(
    () => new Map(entries.map(e => [e.name, e])),
    [entries],
  )
  // A captured name with no entry behind it is a card the data no longer has at
  // all, which is not the same as one that stopped matching: drop it.
  const queue = useMemo(
    () => names.map(n => byName.get(n)).filter(e => e !== undefined),
    [names, byName],
  )
  const selected = useMemo(() => new Set(matching.map(e => e.name)), [matching])
  const leaving = useMemo(
    () => new Set(queue.map(e => e.name).filter(n => !selected.has(n))),
    [queue, selected],
  )

  const refresh = useCallback(() => {
    setPinned({ key: viewKey, names: matching.map(e => e.name) })
  }, [matching, viewKey])

  const dismiss = useCallback((name: string) => {
    setPinned(p => ({ ...p, names: p.names.filter(n => n !== name) }))
  }, [])

  return { queue, leaving, refresh, dismiss }
}
