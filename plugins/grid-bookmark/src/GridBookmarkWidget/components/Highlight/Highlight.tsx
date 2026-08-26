import { colord } from '@jbrowse/core/util/colord'
import { highlightKey } from '@jbrowse/core/util/highlights'
import {
  HighlightBand,
  HighlightChip,
  useHighlightChip,
} from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { getBookmarkHighlights } from './getBookmarkHighlights.ts'

import type { GridBookmarkModel, IExtendedLGV } from '../../model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'

// a band narrower than the link-icon chip clips it into a smudge, so below this
// width the chip is dropped and the band falls back to its plain label (matches
// the native LGV highlight)
const CHIP_MIN_WIDTH = 24

type Bookmark = GridBookmarkModel['bookmarks'][number]

const BookmarkHighlight = observer(function BookmarkHighlight({
  model,
  session,
  bookmarkWidget,
  bookmark,
}: {
  model: IExtendedLGV
  session: SessionWithWidgets
  bookmarkWidget: GridBookmarkModel
  bookmark: Bookmark
}) {
  const coords = model.getHighlightCoords(bookmark)
  const label = model.labelsVisible ? bookmark.label : undefined
  const { chipVisible, setMenuOpen } = useHighlightChip(
    coords,
    model.showHighlightChips,
  )

  return coords ? (
    <HighlightBand
      coords={coords}
      background={bookmark.highlight}
      label={label}
    >
      {chipVisible && coords.width >= CHIP_MIN_WIDTH ? (
        <HighlightChip
          color={colord(bookmark.highlight)}
          label={label}
          tooltip={bookmark.label}
          setOpen={setMenuOpen}
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
                bookmarkWidget.removeBookmarkObject(bookmark)
              },
            },
          ]}
        />
      ) : null}
    </HighlightBand>
  ) : null
})

const Highlight = observer(function Highlight({
  model,
}: {
  model: IExtendedLGV
}) {
  const { session, bookmarkWidget, bookmarks } = getBookmarkHighlights(model)

  return bookmarkWidget
    ? bookmarks.map((r, idx) => (
        <BookmarkHighlight
          // region fields keep the key stable across pan/zoom (unlike pixel
          // coords); idx disambiguates duplicate bookmarks on the same region
          key={highlightKey(r, idx)}
          model={model}
          session={session}
          bookmarkWidget={bookmarkWidget}
          bookmark={r}
        />
      ))
    : null
})

export default Highlight
