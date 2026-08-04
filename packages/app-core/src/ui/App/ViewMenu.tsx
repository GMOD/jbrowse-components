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
  const viewCount = usePanel
    ? (session.getPanelContainingView(model.id)?.viewIds.length ?? 0)
    : session.views.length

  const classicMoves: Record<ReorderDirection, (id: string) => void> = {
    top: session.moveViewToTop,
    up: session.moveViewUp,
    down: session.moveViewDown,
    bottom: session.moveViewToBottom,
  }

  // In workspace mode the panel's own view-id list is the order that renders;
  // in classic mode it's session.views. Same four directions either way.
  const moveView = (direction: ReorderDirection) => {
    if (usePanel) {
      session.moveViewInPanel(model.id, direction)
    } else {
      classicMoves[direction](model.id)
    }
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
                if (usePanel) {
                  moveViewToNewTab(model.id)
                } else {
                  session.setPendingMove({ type: 'newTab', viewId: model.id })
                }
                session.setUseWorkspaces(true)
              },
            },
            {
              label: 'Move to split view (right side of screen)',
              icon: VerticalSplitIcon,
              onClick: () => {
                if (usePanel) {
                  moveViewToSplitRight(model.id)
                } else {
                  session.setPendingMove({
                    type: 'splitRight',
                    viewId: model.id,
                  })
                }
                session.setUseWorkspaces(true)
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
