import CascadingMenu from '@jbrowse/core/ui/CascadingMenu'
import { bindPopover, bindTrigger, usePopupState } from '@jbrowse/core/ui/hooks'
import { getSession } from '@jbrowse/core/util'
import { nanoid } from '@jbrowse/core/util/nanoid'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import GridViewIcon from '@mui/icons-material/GridView'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import MenuIcon from '@mui/icons-material/Menu'
import TableRowsIcon from '@mui/icons-material/TableRows'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import ViewModuleIcon from '@mui/icons-material/ViewModule'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import { useDockview } from './DockviewContext'

import type { IBaseViewModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type {
  IconButtonProps as IconButtonPropsType,
  SvgIconProps,
} from '@mui/material'

function renameIds(obj: Record<string, unknown>): Record<string, unknown> {
  const idMap = new Map<string, string>()

  function transformIds(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value
    }

    if (Array.isArray(value)) {
      return value.map(transformIds)
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(value)) {
        if (key === 'id' && typeof val === 'string') {
          if (!idMap.has(val)) {
            idMap.set(val, nanoid())
          }
          result[key] = `${val}-${idMap.get(val)}`
        } else {
          result[key] = transformIds(val)
        }
      }
      return result
    }

    return value
  }

  return transformIds(obj) as Record<string, unknown>
}

function useTilingActions() {
  const { api, rearrangePanels } = useDockview()

  const tileHorizontally = () => {
    rearrangePanels(api => {
      const panels = api.panels
      if (panels.length <= 1) {
        return
      }

      const panelStates = panels.map(p => ({
        id: p.id,
        component: 'jbrowseView',
        tabComponent: 'jbrowseTab',
        title: p.title,
        params: p.params,
      }))

      panels.forEach(p => api.removePanel(p))
      panelStates.forEach((state, idx) => {
        api.addPanel({
          ...state,
          position: idx === 0 ? undefined : { referencePanel: panelStates[0]?.id, direction: 'right' },
        })
      })
    })
  }

  const tileVertically = () => {
    rearrangePanels(api => {
      const panels = api.panels
      if (panels.length <= 1) {
        return
      }

      const panelStates = panels.map(p => ({
        id: p.id,
        component: 'jbrowseView',
        tabComponent: 'jbrowseTab',
        title: p.title,
        params: p.params,
      }))

      panels.forEach(p => api.removePanel(p))
      panelStates.forEach((state, idx) => {
        api.addPanel({
          ...state,
          position: idx === 0 ? undefined : { referencePanel: panelStates[0]?.id, direction: 'below' },
        })
      })
    })
  }

  const tileGrid = () => {
    rearrangePanels(api => {
      const panels = api.panels
      if (panels.length <= 1) {
        return
      }

      const panelStates = panels.map(p => ({
        id: p.id,
        component: 'jbrowseView',
        tabComponent: 'jbrowseTab',
        title: p.title,
        params: p.params,
      }))

      panels.forEach(p => api.removePanel(p))

      const cols = Math.ceil(Math.sqrt(panelStates.length))
      panelStates.forEach((state, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)

        let position
        if (idx === 0) {
          position = undefined
        } else if (col === 0) {
          const refIdx = (row - 1) * cols
          position = { referencePanel: panelStates[refIdx]?.id, direction: 'below' as const }
        } else {
          position = { referencePanel: panelStates[idx - 1]?.id, direction: 'right' as const }
        }

        api.addPanel({ ...state, position })
      })
    })
  }

  const stackAll = () => {
    rearrangePanels(api => {
      const panels = api.panels
      if (panels.length <= 1) {
        return
      }

      const panelStates = panels.map(p => ({
        id: p.id,
        component: 'jbrowseView',
        tabComponent: 'jbrowseTab',
        title: p.title,
        params: p.params,
      }))

      panels.forEach(p => api.removePanel(p))
      panelStates.forEach((state, idx) => {
        api.addPanel({
          ...state,
          position: idx === 0 ? undefined : { referencePanel: panelStates[0]?.id, direction: 'within' },
        })
      })
    })
  }

  return { api, tileHorizontally, tileVertically, tileGrid, stackAll }
}

const ViewMenu = observer(function ({
  model,
  IconButtonProps,
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
  }

  const popupState = usePopupState({
    variant: 'popover',
  })

  const { api, tileHorizontally, tileVertically, tileGrid, stackAll } = useTilingActions()

  // note: This does not use CascadingMenuButton on purpose, because there was
  // a confusing bug related to it! see
  // https://github.com/GMOD/jbrowse-components/issues/4115
  //
  // Make sure to test the Breakpoint split view menu checkboxes if you intend
  // to change this
  return (
    <>
      <IconButton
        {...IconButtonProps}
        {...bindTrigger(popupState)}
        data-testid="view_menu_icon"
      >
        <MenuIcon {...IconProps} fontSize="small" />
      </IconButton>
      <CascadingMenu
        {...bindPopover(popupState)}
        onMenuItemClick={(_event: unknown, callback: () => void) => {
          callback()
        }}
        menuItems={[
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
          ...(api && session.views.length > 1
            ? [
                {
                  label: 'Layout',
                  icon: GridViewIcon,
                  type: 'subMenu' as const,
                  subMenu: [
                    {
                      label: 'Tile horizontally',
                      icon: ViewColumnIcon,
                      onClick: tileHorizontally,
                    },
                    {
                      label: 'Tile vertically',
                      icon: TableRowsIcon,
                      onClick: tileVertically,
                    },
                    {
                      label: 'Tile grid',
                      icon: ViewModuleIcon,
                      onClick: tileGrid,
                    },
                    {
                      label: 'Stack all (tabs)',
                      icon: GridViewIcon,
                      onClick: stackAll,
                    },
                  ],
                },
              ]
            : []),

          ...model.menuItems(),
        ]}
        popupState={popupState}
      />
    </>
  )
})
export default ViewMenu
