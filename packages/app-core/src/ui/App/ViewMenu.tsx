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
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import { useDockview } from './DockviewContext'
import { renameIds } from './copyView'

import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type {
  IconButtonProps as IconButtonPropsType,
  SvgIconProps,
} from '@mui/material'

const ViewMenu = observer(function ViewMenu({
  model,
  IconProps,
}: {
  model: IBaseViewModel
  IconButtonProps?: IconButtonPropsType
  IconProps: SvgIconProps
}) {
  const session = getSession(model) as AbstractSessionModel & {
    moveViewDown: (arg: string) => void
    moveViewUp: (arg: string) => void
    moveViewToBottom: (arg: string) => void
    moveViewToTop: (arg: string) => void
    useWorkspaces: boolean
    setUseWorkspaces: (arg: boolean) => void
  }

  const { moveViewToNewTab, moveViewToSplitRight } = useDockview()
  return (
    <CascadingMenuButton
      data-testid="view_menu_icon"
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
                      // @ts-expect-error
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
                transaction(() => {
                  session.setUseWorkspaces(true)
                })
                transaction(() => {
                  moveViewToNewTab(model.id)
                })
              },
            },
            {
              label: 'Move to split view (right side of screen)',
              icon: VerticalSplitIcon,
              onClick: () => {
                transaction(() => {
                  session.setUseWorkspaces(true)
                })
                transaction(() => {
                  moveViewToSplitRight(model.id)
                })
              },
            },
            ...(session.views.length > 2
              ? [
                  {
                    label: 'Move view to top',
                    icon: KeyboardDoubleArrowUpIcon,
                    onClick: () => {
                      session.moveViewToTop(model.id)
                    },
                  },
                ]
              : []),
            ...(session.views.length > 1
              ? [
                  {
                    label: 'Move view up',
                    icon: KeyboardArrowUpIcon,
                    onClick: () => {
                      session.moveViewUp(model.id)
                    },
                  },
                  {
                    label: 'Move view down',
                    icon: KeyboardArrowDownIcon,
                    onClick: () => {
                      session.moveViewDown(model.id)
                    },
                  },
                ]
              : []),
            ...(session.views.length > 2
              ? [
                  {
                    label: 'Move view to bottom',
                    icon: KeyboardDoubleArrowDownIcon,
                    onClick: () => {
                      session.moveViewToBottom(model.id)
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
