import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { observer } from 'mobx-react'

import TrackSelectorTrackMenu from './TrackSelectorTrackMenu.tsx'
import { useMenuGuardedClick } from './useMenuGuardedClick.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui/Menu'

const DropdownTrackSelector = observer(function DropdownTrackSelector({
  model,
  tracks,
  extraMenuItems,
  children,
  onClick,
  tooltip,
  'data-testid': testId,
}: {
  model: HierarchicalTrackSelectorModel
  tracks: AnyConfigurationModel[]
  extraMenuItems: MenuItem[]
  onClick?: () => void
  tooltip?: string
  'data-testid'?: string
  children: React.ReactElement
}) {
  const { view } = model
  const { setMenuOpen, guard } = useMenuGuardedClick()
  const session = getSession(model)
  return view ? (
    <CascadingMenuButton
      closeAfterItemClick={false}
      onClick={onClick}
      tooltip={tooltip}
      data-testid={testId}
      // these badge buttons sit at the right edge of the header, so align the
      // dropdown's right edge under the icon
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
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
              if (model.view.toggleTrack(t.trackId)) {
                model.addToRecentlyUsed(t.trackId)
              }
            })
          },
        })),
        ...extraMenuItems,
      ]}
    >
      {children}
    </CascadingMenuButton>
  ) : null
})

export default DropdownTrackSelector
