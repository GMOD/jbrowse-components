import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import FilledStarIcon from '@mui/icons-material/Star'
import StarIcon from '@mui/icons-material/StarBorderOutlined'
import { observer } from 'mobx-react'

import IconButtonLite from './IconButtonLite.tsx'
import MoreHorizGlyph from './MoreHorizGlyph.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const TrackSelectorTrackMenu = observer(function TrackSelectorTrackMenu({
  id,
  stopPropagation,
  model,
  setOpen,
  conf,
}: {
  id: string
  stopPropagation?: boolean
  conf: AnyConfigurationModel
  setOpen?: (arg: boolean) => void
  model: HierarchicalTrackSelectorModel
}) {
  const trackId = conf.trackId

  return (
    <CascadingMenuButton
      ButtonComponent={IconButtonLite}
      padding={0}
      stopPropagation={stopPropagation}
      setOpen={setOpen}
      data-testid={`htsTrackEntryMenu-${id}`}
      menuItems={() => {
        const session = getSession(model)
        const flatMenuItems =
          session.getTrackListMenuItems?.(conf, model.trackContainer) ?? []
        return [
          ...flatMenuItems,
          model.isFavorite(trackId)
            ? {
                label: 'Remove from favorites',
                onClick: () => {
                  model.removeFromFavorites(trackId)
                },
                icon: FilledStarIcon,
              }
            : {
                label: 'Add to favorites',
                onClick: () => {
                  model.addToFavorites(trackId)
                },
                icon: StarIcon,
              },
          model.isSelected(trackId)
            ? {
                label: 'Remove from selection',
                onClick: () => {
                  model.removeFromSelection([trackId])
                },
              }
            : {
                label: 'Add to selection',
                onClick: () => {
                  model.addToSelection([trackId])
                },
              },
        ]
      }}
    >
      <MoreHorizGlyph />
    </CascadingMenuButton>
  )
})

export default TrackSelectorTrackMenu
