import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Badge } from '@mui/material'
import { observer } from 'mobx-react'

import TrackSelectorTrackMenu from './TrackSelectorTrackMenu.tsx'
import { useMenuGuardedClick } from './useMenuGuardedClick.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui/Menu'

const useStyles = makeStyles()({
  smallBadge: {
    height: 14,
  },
  margin: {
    marginRight: 10,
  },
})

const bottomRight = { vertical: 'bottom', horizontal: 'right' } as const
const topRight = { vertical: 'top', horizontal: 'right' } as const

// Badge button (favorites / recently-used) opening a dropdown of tracks with a
// clear action; the badge counts additions since the dropdown was last opened
const BadgeDropdownTracks = observer(function BadgeDropdownTracks({
  model,
  tracks,
  counter,
  icon,
  tooltip,
  clearLabel,
  emptyLabel,
  onClear,
  onOpen,
  'data-testid': testId,
}: {
  model: HierarchicalTrackSelectorModel
  tracks: AnyConfigurationModel[]
  counter: number
  icon: React.ReactNode
  tooltip: string
  clearLabel: string
  emptyLabel: string
  onClear: () => void
  onOpen: () => void
  'data-testid'?: string
}) {
  const { classes } = useStyles()
  const { setMenuOpen, guard } = useMenuGuardedClick()
  const session = getSession(model)
  const footer: MenuItem[] = tracks.length
    ? [{ type: 'divider' }, { label: clearLabel, onClick: onClear }]
    : [{ label: emptyLabel, disabled: true, onClick: () => {} }]
  return model.trackContainer ? (
    <CascadingMenuButton
      closeAfterItemClick={false}
      onClick={onOpen}
      tooltip={tooltip}
      data-testid={testId}
      // the badges sit at the right edge of the header
      anchorOrigin={bottomRight}
      transformOrigin={topRight}
      menuItems={[
        ...tracks.map(t => ({
          type: 'checkbox' as const,
          label: (
            <>
              <SanitizedHTML html={getTrackName(t, session)} />{' '}
              <TrackSelectorTrackMenu
                id={t.trackId}
                model={model}
                conf={t}
                setOpen={open => {
                  setMenuOpen(open)
                }}
                stopPropagation
              />
            </>
          ),
          checked: model.shownTrackIds.has(t.trackId),
          onClick: () => {
            guard(() => {
              void model.toggleTrack(t.trackId)
            })
          },
        })),
        ...footer,
      ]}
    >
      <Badge
        classes={{ badge: classes.smallBadge }}
        color="secondary"
        anchorOrigin={bottomRight}
        className={classes.margin}
        badgeContent={counter}
      >
        {icon}
      </Badge>
    </CascadingMenuButton>
  ) : null
})

export default BadgeDropdownTracks
