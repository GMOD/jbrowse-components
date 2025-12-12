import React, { memo, useCallback } from 'react'

import { getSession } from '@jbrowse/core/util'
import FilledStarIcon from '@mui/icons-material/Star'
import StarIcon from '@mui/icons-material/StarBorderOutlined'

import { CascadingMenuButton } from '../../../vendoredMUI'

import type { HierarchicalTrackSelectorModel } from '../../model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// Inline SVG to avoid MuiSvgIconRoot overhead
const svgStyle: React.CSSProperties = {
  width: '1em',
  height: '1em',
  fontSize: '1.375rem', // 22px
  display: 'inline-block',
  flexShrink: 0,
  fill: 'currentColor',
}

const MoreHorizIcon = memo(function MoreHorizIcon() {
  return (
    <svg style={svgStyle} viewBox="0 0 24 24">
      <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  )
})

const cascadingStyle = { padding: 0 }

const TrackSelectorTrackMenu = memo(function TrackSelectorTrackMenu({
  id,
  trackId,
  stopPropagation,
  model,
  setOpen,
  conf,
}: {
  id: string
  trackId: string
  stopPropagation?: boolean
  conf: AnyConfigurationModel
  setOpen?: (arg: boolean) => void
  model: HierarchicalTrackSelectorModel
}) {
  const getMenuItems = useCallback(
    () => [
      ...(getSession(model).getTrackActionMenuItems?.(conf) || []),
      model.isFavorite(trackId)
        ? {
            label: 'Remove from favorites',
            onClick: () => {
              model.removeFromFavorites(trackId)
            },
            icon: StarIcon,
          }
        : {
            label: 'Add to favorites',
            onClick: () => {
              model.addToFavorites(trackId)
            },
            icon: FilledStarIcon,
          },
      {
        label: 'Add to selection',
        onClick: () => {
          model.addToSelection([conf])
        },
      },
      ...(model.isSelected(conf)
        ? [
            {
              label: 'Remove from selection',
              onClick: () => {
                model.removeFromSelection([conf])
              },
            },
          ]
        : []),
    ],
    [conf, model, trackId],
  )

  return (
    <CascadingMenuButton
      style={cascadingStyle}
      stopPropagation={stopPropagation}
      setOpen={setOpen}
      data-testid={`htsTrackEntryMenu-${id}`}
      menuItems={getMenuItems}
    >
      <MoreHorizIcon />
    </CascadingMenuButton>
  )
})

export default TrackSelectorTrackMenu
