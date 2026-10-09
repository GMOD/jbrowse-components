import { observer } from 'mobx-react'

import type React from 'react'

export interface SearchPickerView {
  searchPicker?: {
    query: string
    rows: readonly {
      id: string
      label: string
      location: string
      trackName: string
    }[]
    pick: (id: string) => Promise<unknown>
  }
  closeSearchPicker: () => void
}

/**
 * Lists the places a name search points at when it matches several and none
 * exactly, which `view.navToLocString` leaves to the host instead of
 * navigating. Draws nothing until a search sets `view.searchPicker`. A
 * `LocationBox` mounts one under itself.
 */
export const SearchPicker = observer(function SearchPicker({
  view,
  style,
}: {
  view: SearchPickerView
  style?: React.CSSProperties
}) {
  const { searchPicker } = view
  return searchPicker ? (
    <div
      role="dialog"
      aria-label="Search results"
      data-testid="search-picker"
      style={{ fontSize: '0.8rem', paddingBottom: 8, ...style }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <strong style={{ flex: 1 }}>
          “{searchPicker.query}” matches {searchPicker.rows.length} places
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
        {searchPicker.rows.map(row => (
          <li key={row.id}>
            <button
              type="button"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => {
                void searchPicker.pick(row.id)
              }}
            >
              <strong>{row.label}</strong> {row.location} {row.trackName}
            </button>
          </li>
        ))}
      </ul>
    </div>
  ) : null
})
