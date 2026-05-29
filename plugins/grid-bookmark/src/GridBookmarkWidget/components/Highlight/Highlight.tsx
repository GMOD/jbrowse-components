import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { HighlightBand } from '@jbrowse/plugin-linear-genome-view'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import { Box, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { GridBookmarkModel, IExtendedLGV } from '../../model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'

type LGV = IExtendedLGV

const Highlight = observer(function Highlight({ model }: { model: LGV }) {
  const session = getSession(model) as SessionWithWidgets
  const { bookmarkHighlightsVisible, labelsVisible } = model

  const bookmarkWidget = session.widgets.get('GridBookmark') as
    | GridBookmarkModel
    | undefined

  const viewAssemblies = new Set(model.assemblyNames)

  return bookmarkHighlightsVisible && bookmarkWidget?.bookmarks
    ? bookmarkWidget.bookmarks
        .filter(r => viewAssemblies.has(r.assemblyName))
        .map((r, idx) => {
          const coords = model.getHighlightCoords(r)
          const bandColor = colord(r.highlight)
          // match band color but bump alpha to 0.8 so the chip is legible;
          // if the band is fully transparent, hide the chip color too
          const chipAlpha = bandColor.alpha() === 0 ? 0 : 0.8
          return coords ? (
            <HighlightBand
              // region fields keep the key stable across pan/zoom (unlike
              // pixel coords); idx disambiguates duplicate bookmarks on the
              // same region
              // biome-ignore lint/suspicious/noArrayIndexKey: idx is a suffix
              key={`${r.assemblyName}_${r.refName}_${r.start}_${r.end}_${idx}`}
              coords={coords}
              background={r.highlight}
            >
              <CascadingMenuButton
                menuItems={[
                  {
                    label: 'Open bookmark widget',
                    onClick: () => {
                      session.showWidget(bookmarkWidget)
                    },
                  },
                  {
                    label: 'Turn off bookmark highlights',
                    onClick: () => {
                      bookmarkWidget.setBookmarkHighlightsVisible(false)
                    },
                  },
                  {
                    label: 'Remove bookmark',
                    onClick: () => {
                      bookmarkWidget.removeBookmarkObject(r)
                    },
                  },
                ]}
              >
                <Tooltip title={r.label} arrow>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <BookmarkIcon
                      fontSize="small"
                      sx={{ color: bandColor.alpha(chipAlpha).toRgbString() }}
                    />
                    {r.label && labelsVisible ? (
                      <Typography variant="caption" noWrap>
                        {r.label}
                      </Typography>
                    ) : null}
                  </Box>
                </Tooltip>
              </CascadingMenuButton>
            </HighlightBand>
          ) : null
        })
    : null
})

export default Highlight
