import { canonicalLocString } from '@jbrowse/core/TextSearch/places'
import { getSession } from '@jbrowse/core/util/mstUtils'
import { observer } from 'mobx-react'

import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type React from 'react'

export interface SearchPickerView extends IStateTreeNode {
  searchPicker?: {
    query: string
    assemblyName: string
    results: readonly BaseResult[]
    pick: (result: BaseResult) => Promise<unknown>
  }
  closeSearchPicker: () => void
}

/**
 * Lists the hits of a name search that point at more than one place, which
 * `view.navToLocString` leaves to the host instead of navigating. Draws nothing
 * until a search raises `view.searchPicker`.
 */
export const SearchPicker = observer(function SearchPicker({
  view,
  style,
}: {
  view: SearchPickerView
  style?: React.CSSProperties
}) {
  const { searchPicker } = view
  if (!searchPicker) {
    return null
  }
  const session = getSession(view)
  const assembly = session.assemblyManager.get(searchPicker.assemblyName)
  return (
    <div
      role="dialog"
      aria-label="Search results"
      data-testid="search-picker"
      style={{ fontSize: '0.8rem', paddingBottom: 8, ...style }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong style={{ flex: 1 }}>
          “{searchPicker.query}” matches {searchPicker.results.length} places
        </strong>
        <button
          type="button"
          aria-label="Close search results"
          onClick={view.closeSearchPicker}
        >
          ✕
        </button>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {searchPicker.results.map(result => {
          const location = result.getLocation()
          const trackId = result.getTrackId()
          const trackName = trackId
            ? session.getTrackById(trackId)?.name
            : undefined
          return (
            <li key={result.getId()}>
              <button
                type="button"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => {
                  void searchPicker.pick(result)
                }}
              >
                <strong>{result.getLabel()}</strong>{' '}
                {assembly && location
                  ? canonicalLocString(location, assembly)
                  : location}{' '}
                {trackName}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
})
