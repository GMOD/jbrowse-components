import React from 'react'
import { makeStyles } from 'tss-react/mui'
import { getSession } from '@jbrowse/core/util'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

// icons
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import StarIcon from '@mui/icons-material/StarBorderOutlined'
import FilledStarIcon from '@mui/icons-material/Star'

// locals
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { HierarchicalTrackSelectorModel } from '../../model'

const useStyles = makeStyles()({
  cascadingStyle: {
    padding: 0,
  },
})

const TrackLabelMenu = function ({
  id,
  trackId,
  model,
  selected,
  conf,
}: {
  id: string
  trackId: string
  selected: boolean
  conf: AnyConfigurationModel
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  return (
    <CascadingMenuButton
      className={classes.cascadingStyle}
      data-testid={`htsTrackEntryMenu-${id}`}
      menuItems={[
        ...(getSession(model).getTrackActionMenuItems?.(conf) || []),
        model.isFavorite(trackId)
          ? {
              label: 'Remove from favorites',
              onClick: () => model.removeFromFavorites(trackId),
              icon: StarIcon,
            }
          : {
              label: 'Add to favorites',
              onClick: () => model.addToFavorites(trackId),
              icon: FilledStarIcon,
            },
        {
          label: 'Add to selection',
          onClick: () => model.addToSelection([conf]),
        },
        ...(selected
          ? [
              {
                label: 'Remove from selection',
                onClick: () => model.removeFromSelection([conf]),
              },
            ]
          : []),
      ]}
    >
      <MoreHorizIcon />
    </CascadingMenuButton>
  )
}

export default TrackLabelMenu
