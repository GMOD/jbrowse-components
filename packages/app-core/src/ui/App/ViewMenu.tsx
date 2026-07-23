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

  const moveView = (
    panelFn: (id: string) => void,
    sessionFn: (id: string) => void,
  ) => {
    if (usePanel) {
      panelFn(model.id)
    } else {
      sessionFn(model.id)
    }
  }

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
            ...(viewCount > 2
              ? [
                  {
                    label: 'Move view to top',
                    icon: KeyboardDoubleArrowUpIcon,
                    onClick: () => {
                      moveView(
                        session.moveViewToTopInPanel,
                        session.moveViewToTop,
                      )
                    },
                  },
                ]
              : []),
            ...(viewCount > 1
              ? [
                  {
                    label: 'Move view up',
                    icon: KeyboardArrowUpIcon,
                    onClick: () => {
                      moveView(session.moveViewUpInPanel, session.moveViewUp)
                    },
                  },
                  {
                    label: 'Move view down',
                    icon: KeyboardArrowDownIcon,
                    onClick: () => {
                      moveView(
                        session.moveViewDownInPanel,
                        session.moveViewDown,
                      )
                    },
                  },
                ]
              : []),
            ...(viewCount > 2
              ? [
                  {
                    label: 'Move view to bottom',
                    icon: KeyboardDoubleArrowDownIcon,
                    onClick: () => {
                      moveView(
                        session.moveViewToBottomInPanel,
                        session.moveViewToBottom,
                      )
                    },
                  },
                ]
              : []),
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
