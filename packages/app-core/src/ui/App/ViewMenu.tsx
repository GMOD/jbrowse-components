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
import type { SvgIconProps } from '@mui/material'

type ViewMenuSession = SessionWithMultipleViews & SessionWithDockviewLayout

const ViewMenu = observer(function ViewMenu({
  model,
  IconProps,
}: {
  model: IBaseViewModel
  IconProps: SvgIconProps
}) {
  const session = getSession(model) as unknown as ViewMenuSession

  const { moveViewToNewTab, moveViewToSplitRight } = useDockview()
  const usePanel =
    session.effectiveUseWorkspaces && isSessionWithDockviewLayout(session)
  // The views this move is relative to: in a workspace, the ones sharing this
  // view's panel; in the classic stack, all of them. `session.views` is the
  // order either way, so the mode decides the SCOPE of a move and nothing else
  // — there is one implementation of "move a view" again.
  const scopeIds = usePanel
    ? session.getPanelContainingView(model.id)?.viewIds.slice()
    : undefined
  const viewCount = scopeIds?.length ?? session.views.length

  const moves: Record<
    ReorderDirection,
    (id: string, scopeIds?: string[]) => void
  > = {
    top: session.moveViewToTop,
    up: session.moveViewUp,
    down: session.moveViewDown,
    bottom: session.moveViewToBottom,
  }

  const moveView = (direction: ReorderDirection) => {
    moves[direction](model.id, scopeIds)
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

  // 'top'/'bottom' only mean something with a view above *and* below
  const moveItems = (
    [
      ['top', 'Move view to top', KeyboardDoubleArrowUpIcon, 2],
      ['up', 'Move view up', KeyboardArrowUpIcon, 1],
      ['down', 'Move view down', KeyboardArrowDownIcon, 1],
      ['bottom', 'Move view to bottom', KeyboardDoubleArrowDownIcon, 2],
    ] as const
  ).flatMap(([direction, label, icon, minViews]) =>
    viewCount > minViews
      ? [
          {
            label,
            icon,
            onClick: () => {
              moveView(direction)
            },
          },
        ]
      : [],
  )

  return (
    <CascadingMenuButton
      data-testid="view_menu_icon"
      tooltip="View menu"
      menuItems={() => [
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
            ...moveItems,
          ],
        },
        ...model.menuItems(),
      ]}
    >
      <MenuIcon {...IconProps} fontSize="small" />
    </CascadingMenuButton>
  )
})
export default ViewMenu
