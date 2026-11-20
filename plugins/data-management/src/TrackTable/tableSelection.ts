import { transaction } from 'mobx'

import { isUnsupported } from '../HierarchicalTrackSelectorWidget/util.ts'

import type { HierarchicalTrackSelectorModel } from '../HierarchicalTrackSelectorWidget/model.ts'

/**
 * Shows or hides a set of tracks by id, for the table's show-all and a tree
 * category's Show all and Hide all. Recently used lists the tracks picked one
 * at a time (`toggleTrack`), so a bulk show records none of them: a category
 * of 30 would push every pick out of the list's 10
 */
export function setTracksShown(
  model: HierarchicalTrackSelectorModel,
  ids: string[],
  shown: boolean,
) {
  if (shown) {
    // A display's state model may still be a dynamic import away, so the shows
    // cannot sit inside a transaction — they are awaited one at a time, which
    // also keeps the tracks in the order the caller listed them
    const { trackContainer } = model
    void (async () => {
      for (const id of ids) {
        await trackContainer?.launchTrack(id)
      }
    })()
  } else {
    transaction(() => {
      for (const id of ids) {
        model.trackContainer?.hideTrack(id)
      }
    })
  }
}

/**
 * The show-all checkbox's state and toggle over the rows a filter kept. A
 * placeholder track that cannot be shown is never counted.
 */
export function getShowAllState({
  model,
  shownTrackIds,
  rows,
}: {
  model: HierarchicalTrackSelectorModel
  shownTrackIds: Set<string>
  rows: readonly { id: string; name: string }[]
}) {
  const showable = rows.filter(row => !isUnsupported(row.name))
  const allShown =
    showable.length > 0 && showable.every(row => shownTrackIds.has(row.id))
  const someShown = !allShown && showable.some(row => shownTrackIds.has(row.id))

  return {
    allShown,
    someShown,
    toggleAll: () => {
      setTracksShown(
        model,
        showable
          .filter(row => allShown || !shownTrackIds.has(row.id))
          .map(row => row.id),
        !allShown,
      )
    },
  }
}
