import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import FilledStarIcon from '@mui/icons-material/Star'
import StarIcon from '@mui/icons-material/StarBorderOutlined'
import { observer } from 'mobx-react'

import IconButtonLite from './IconButtonLite.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// MoreHoriz path from @mui/icons-material, inlined to avoid an SvgIcon per row
const moreHorizPath =
  'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2'

const useStyles = makeStyles()(theme => ({
  icon: {
    width: theme.typography.pxToRem(24),
    height: theme.typography.pxToRem(24),
    display: 'block',
    flexShrink: 0,
    fill: 'currentColor',
  },
}))

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
  const { classes } = useStyles()
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
          session.getTrackListMenuItems?.(conf, model.view) ?? []
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
          model.isSelected(conf)
            ? {
                label: 'Remove from selection',
                onClick: () => {
                  model.removeFromSelection([conf])
                },
              }
            : {
                label: 'Add to selection',
                onClick: () => {
                  model.addToSelection([conf])
                },
              },
        ]
      }}
    >
      <svg className={classes.icon} viewBox="0 0 24 24" aria-hidden>
        <path d={moreHorizPath} />
      </svg>
    </CascadingMenuButton>
  )
})

export default TrackSelectorTrackMenu
