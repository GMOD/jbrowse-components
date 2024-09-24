import React, { lazy } from 'react'
import { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

// icons
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

// locals
import { locationLinkClick } from '../../components/util'
import { getEnv } from 'mobx-state-tree'

// lazies
const BreakendMultiLevelOptionDialog = lazy(
  () => import('./BreakendMultiLevelOptionDialog'),
)
const BreakendSingleLevelOptionDialog = lazy(
  () => import('./BreakendSingleLevelOptionDialog'),
)

export default function FeatureMenu({
  assemblyName,
  session,
  arg,
  spreadsheetViewId,
}: {
  spreadsheetViewId: string
  assemblyName: string
  session: AbstractSessionModel
  arg: {
    value?: string
    row: {
      feature: Feature
      loc: string
    }
  }
}) {
  const { row } = arg
  return (
    <CascadingMenuButton
      menuItems={[
        {
          label: 'Open in linear genome view',
          onClick: async () => {
            try {
              await locationLinkClick({
                spreadsheetViewId,
                locString: row.loc,
                assemblyName,
                session,
              })
            } catch (e) {
              console.error(e)
              session.notifyError(`${e}`, e)
            }
          },
        },
        {
          label: 'Open in single-level split view',
          onClick: async () => {
            const { pluginManager } = getEnv(session)
            const viewType = pluginManager.getViewType('BreakpointSplitView')!
            session.queueDialog(handleClose => [
              BreakendSingleLevelOptionDialog,
              {
                handleClose,
                session,
                feature: row.feature,
                viewType,
                assemblyName,
              },
            ])
          },
        },
        {
          label: 'Open in multi-level split view',
          onClick: async () => {
            const { pluginManager } = getEnv(session)
            const viewType = pluginManager.getViewType('BreakpointSplitView')!
            session.queueDialog(handleClose => [
              BreakendMultiLevelOptionDialog,
              {
                handleClose,
                session,
                feature: row.feature,
                viewType,
                assemblyName,
              },
            ])
          },
        },
      ]}
    >
      <ArrowDropDownIcon />
    </CascadingMenuButton>
  )
}
