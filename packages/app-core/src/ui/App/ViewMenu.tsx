import { CascadingMenuButton } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import MenuIcon from '@mui/icons-material/Menu'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit'
import { observer } from 'mobx-react'

import { isSessionWithDockviewLayout } from '../../DockviewLayout/index.ts'
import { useDockview } from './DockviewContext.tsx'
import { renameIds } from './copyView.ts'

import type { SessionWithDockviewLayout } from '../../DockviewLayout/index.ts'
import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { ReorderDirection } from '@jbrowse/core/util'
import type { SessionWithMultipleViews } from '@jbrowse/product-core'

type ViewMenuSession = SessionWithMultipleViews & SessionWithDockviewLayout

// takes the icon's class, not an SvgIconProps object: the object was built
// inline by ViewHeader and so was new on each of its renders, which defeated
// mobx-react's memo for this whole menu (a Tooltip and an IconButton) every
// time anything re-rendered the header
const ViewMenu = observer(function ViewMenu({
  model,
  className,
}: {
  model: IBaseViewModel
  className?: string
}) {
  const session = getSession(model) as unknown as ViewMenuSession

  const { moveViewToNewTab, moveViewToSplitRight } = useDockview()
  const usePanel =
    session.effectiveUseWorkspaces && isSessionWithDockviewLayout(session)

  const moves: Record<
    ReorderDirection,
    (id: string, scopeIds?: string[]) => void
  > = {
    top: session.moveViewToTop,
    up: session.moveViewUp,
    down: session.moveViewDown,
    bottom: session.moveViewToBottom,
  }

  // Give this view a home of its own: its own tab beside the rest, or its own
  // split to their right. With a workspace already up that's an api call on the
  // live panels; from the classic stack there are no panels yet, so describe
  // the arrangement as an `init` and let the controller build it on the way in.
  const moveViewOut = (direction: 'tabs' | 'horizontal') => {
    if (usePanel) {
      if (direction === 'tabs') {
        moveViewToNewTab(model.id)
      } else {
        moveViewToSplitRight(model.id)
      }
    } else {
      const others = session.views.flatMap(v =>
        v.id === model.id ? [] : [v.id],
      )
      session.setInit(
        others.length > 0
          ? {
              direction,
              children: [{ viewIds: others }, { viewIds: [model.id] }],
            }
          : { viewIds: [model.id] },
      )
    }
    session.setUseWorkspaces(true)
  }

  return (
    <CascadingMenuButton
      data-testid="view_menu_icon"
      tooltip="View menu"
      menuItems={() => {
        // The views this move is relative to: in a workspace, the ones sharing
        // this view's panel; in the classic stack, all of them. `session.views`
        // is the order either way, so the mode decides the SCOPE of a move and
        // nothing else. There is one implementation of "move a view" again.
        //
        // Resolved here rather than during render. It scans every panel's
        // assignment list and copies one of them, and reading those lists in
        // render would also subscribe this menu to them, so a view moving
        // between panels anywhere re-rendered every view's menu. None of it is
        // needed until the menu opens.
        const scopeIds = usePanel
          ? session.getPanelContainingView(model.id)?.viewIds.slice()
          : undefined
        const viewCount = scopeIds?.length ?? session.views.length
        return [
          {
            label: 'View options',
            type: 'subMenu' as const,
            subMenu: [
              {
                label: 'Copy view',
                icon: ContentCopyIcon,
                onClick: () => {
                  session.addView(
                    model.type,
                    renameIds(
                      structuredClone(
                        getSnapshot(model) as Record<string, unknown>,
                      ),
                    ),
                  )
                },
              },
              {
                label: 'Move to new tab',
                icon: OpenInNewIcon,
                onClick: () => {
                  moveViewOut('tabs')
                },
              },
              {
                label: 'Move to split view (right side of screen)',
                icon: VerticalSplitIcon,
                onClick: () => {
                  moveViewOut('horizontal')
                },
              },
              // 'top'/'bottom' only mean something with a view above *and* below
              ...(
                [
                  ['top', 'Move view to top', KeyboardDoubleArrowUpIcon, 2],
                  ['up', 'Move view up', KeyboardArrowUpIcon, 1],
                  ['down', 'Move view down', KeyboardArrowDownIcon, 1],
                  [
                    'bottom',
                    'Move view to bottom',
                    KeyboardDoubleArrowDownIcon,
                    2,
                  ],
                ] as const
              ).flatMap(([direction, label, icon, minViews]) =>
                viewCount > minViews
                  ? [
                      {
                        label,
                        icon,
                        onClick: () => {
                          moves[direction](model.id, scopeIds)
                        },
                      },
                    ]
                  : [],
              ),
            ],
          },
          ...model.menuItems(),
        ]
      }}
    >
      <MenuIcon className={className} fontSize="small" />
    </CascadingMenuButton>
  )
})
export default ViewMenu
