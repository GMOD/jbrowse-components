import { colord } from '@jbrowse/core/util/colord'
import { highlightKey } from '@jbrowse/core/util/highlights'
import {
  HighlightBand,
  HighlightChip,
} from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { getBookmarkHighlights } from './getBookmarkHighlights.ts'

import type { IExtendedLGV } from '../../model.ts'

// a band narrower than the link-icon chip clips it into a smudge, so below this
// width the chip is dropped and the band falls back to its plain label (matches
// the native LGV highlight)
const CHIP_MIN_WIDTH = 24

const Highlight = observer(function Highlight({
  model,
}: {
  model: IExtendedLGV
}) {
  const { labelsVisible, showHighlightChips } = model
  const { session, bookmarkWidget, bookmarks } = getBookmarkHighlights(model)

  return bookmarkWidget
    ? bookmarks.map((r, idx) => {
        const coords = model.getHighlightCoords(r)
        const label = labelsVisible ? r.label : undefined
        return coords ? (
          <HighlightBand
            // region fields keep the key stable across pan/zoom (unlike pixel
            // coords); idx disambiguates duplicate bookmarks on the same region
            key={highlightKey(r, idx)}
            coords={coords}
            background={r.highlight}
            label={label}
          >
            {showHighlightChips && coords.width >= CHIP_MIN_WIDTH ? (
              <HighlightChip
                color={colord(r.highlight)}
                label={label}
                tooltip={r.label}
                menuItems={[
                  {
                    label: 'Open bookmark widget',
                    onClick: () => {
                      session.showWidget(bookmarkWidget)
                    },
                  },
                  {
                    label: 'Turn off highlights',
                    onClick: () => {
                      session.setHighlightsVisible(false)
                    },
                  },
                  {
                    label: 'Remove bookmark',
                    onClick: () => {
                      bookmarkWidget.removeBookmarkObject(r)
                    },
                  },
                ]}
              />
            ) : null}
          </HighlightBand>
        ) : null
      })
    : null
})

export default Highlight
