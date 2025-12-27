import React, { memo, useCallback } from 'react'

import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import FilledStarIcon from '@mui/icons-material/Star'
import StarIcon from '@mui/icons-material/StarBorderOutlined'

import { CascadingMenuButton } from '../../../vendoredMUI'

import type { HierarchicalTrackSelectorModel } from '../../model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const useStyles = makeStyles()(theme => ({
  cascadingButton: {
    padding: 0,
  },
  icon: {
    width: '1em',
    height: '1em',
    fontSize: theme.typography.pxToRem(20),
    display: 'inline-block',
    flexShrink: 0,
    fill: 'currentColor',
  },
}))

const MoreHorizIcon = memo(function MoreHorizIcon({
  className,
}: {
  className: string
}) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  )
})

const TrackSelectorTrackMenu = memo(function TrackSelectorTrackMenu({
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
  const trackId = conf.trackId as string

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
      className={classes.cascadingButton}
      stopPropagation={stopPropagation}
      setOpen={setOpen}
      data-testid={`htsTrackEntryMenu-${id}`}
      menuItems={getMenuItems}
    >
      <MoreHorizIcon className={classes.icon} />
    </CascadingMenuButton>
  )
})

export default TrackSelectorTrackMenu
