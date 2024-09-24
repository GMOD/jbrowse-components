import React from 'react'
import { AbstractSessionModel, Feature, getEnv } from '@jbrowse/core/util'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'

// icons
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

// locals
import { locationLinkClick } from '../../components/util'

export default function FeatureMenu({
  assemblyName,
  session,
  row,
  spreadsheetId,
}: {
  spreadsheetId: string
  assemblyName: string
  session: AbstractSessionModel
  row: {
    feature: Feature
    value: string
  }
}) {
  return (
    <CascadingMenuButton
      menuItems={[
        {
          label: 'Open in linear genome view',
          onClick: async () => {
            try {
              await locationLinkClick({
                spreadsheetViewId,
                locString: row.value,
                assemblyName,
                session,
              })
            } catch (e) {
              console.error(e)
              session.notify(`${e}`, 'error')
            }
          },
        },
        {
          label: 'Open in single level split view',
          onClick: async () => {
            try {
              const { pluginManager } = getEnv(session)
              const viewType = pluginManager.getViewType('BreakpointSplitView')!
              // @ts-expect-error
              const snap = viewType.singleLevelSnapshotFromBreakendFeature({
                feature: row.feature,
                session,
                assemblyName,
              })
              session.addView('BreakpointSplitView', snap)
            } catch (e) {
              console.error(e)
              session.notify(`${e}`, 'error')
            }
          },
        },
        {
          label: 'Open in breakpoint split view',
          onClick: async () => {
            try {
              const { pluginManager } = getEnv(session)
              const viewType = pluginManager.getViewType('BreakpointSplitView')!
              // @ts-expect-error
              const snap = viewType.snapshotFromBreakendFeature({
                feature: row.feature,
                session,
                assemblyName,
              })
              session.addView('BreakpointSplitView', snap)
            } catch (e) {
              console.error(e)
              session.notify(`${e}`, 'error')
            }
          },
        },
      ]}
    >
      <ArrowDropDownIcon />
    </CascadingMenuButton>
  )
}
