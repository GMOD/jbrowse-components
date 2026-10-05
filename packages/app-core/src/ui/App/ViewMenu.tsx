import { CascadingMenuButton } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { renameIds } from '@jbrowse/core/util/types/mst'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import HorizontalSplitIcon from '@mui/icons-material/HorizontalSplit'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import MenuIcon from '@mui/icons-material/Menu'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import TabIcon from '@mui/icons-material/Tab'
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit'
import { observer } from 'mobx-react'

import { tabDisplayName } from '../../WorkspaceLayout/tabName.ts'

import type { WorkspaceLayout } from '../../WorkspaceLayout/model.ts'
import type { WorkspaceSessionType } from './types.ts'
import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { ReorderDirection } from '@jbrowse/core/util'
import type { SessionWithMultipleViews } from '@jbrowse/product-core'

type ViewMenuSession = SessionWithMultipleViews &
  WorkspaceLayout &
  WorkspaceSessionType

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

  const moves: Record<
    ReorderDirection,
    (id: string, scopeIds?: string[]) => void
  > = {
    top: session.moveViewToTop,
    up: session.moveViewUp,
    down: session.moveViewDown,
    bottom: session.moveViewToBottom,
  }

  const moveViewOut = (to: 'tab' | 'row' | 'column') => {
    const allViewIds = session.views.map(v => v.id)
    if (to === 'tab') {
      session.moveViewToNewTab(model.id, allViewIds)
    } else {
      session.moveViewToSplit(model.id, to, allViewIds)
    }
    session.setUseWorkspaces(true)
  }

  // views render in `session.views` order within a tab, so a view joining one
  // goes to its bottom rather than wherever its old slot falls
  const moveViewToTab = (tabId: string) => {
    const members = session.findTab(tabId)?.tab.viewIds ?? []
    session.moveViewToTab(
      model.id,
      tabId,
      session.views.map(v => v.id),
    )
    session.moveViewToBottom(model.id, [...members, model.id])
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
        const home = session.effectiveUseWorkspaces
          ? session.tabContainingView(model.id)
          : undefined
        const scopeIds = home?.tab.viewIds.slice()
        const otherTabs = home
          ? session.tabs.filter(t => t.id !== home.tab.id)
          : []
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
                    renameIds(getSnapshot(model) as Record<string, unknown>),
                  )
                },
              },
              {
                label: 'Move to new tab',
                icon: OpenInNewIcon,
                onClick: () => {
                  moveViewOut('tab')
                },
              },
              ...(otherTabs.length > 0
                ? [
                    {
                      label: 'Move to tab',
                      icon: TabIcon,
                      type: 'subMenu' as const,
                      subMenu: otherTabs.map(tab => ({
                        label: tabDisplayName(
                          tab,
                          session.views.filter(v => tab.viewIds.includes(v.id)),
                          session,
                        ),
                        onClick: () => {
                          moveViewToTab(tab.id)
                        },
                      })),
                    },
                  ]
                : []),
              {
                label: 'Move to split view (right)',
                icon: VerticalSplitIcon,
                onClick: () => {
                  moveViewOut('row')
                },
              },
              {
                label: 'Move to split view (below)',
                icon: HorizontalSplitIcon,
                onClick: () => {
                  moveViewOut('column')
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
