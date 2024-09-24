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
            try {
              const { pluginManager } = getEnv(session)
              const viewType = pluginManager.getViewType('BreakpointSplitView')!
              const snap =
                // @ts-expect-error
                await viewType.singleLevelSnapshotFromBreakendFeature({
                  feature: row.feature,
                  session,
                  assemblyName,
                })
              console.log({ snap })
              session.addView('BreakpointSplitView', snap)
            } catch (e) {
              console.error(e)
              session.notifyError(`${e}`, e)
            }
          },
        },
        {
          label: 'Open in multi-level split view',
          onClick: async () => {
            try {
              const { pluginManager } = getEnv(session)
              const viewType = pluginManager.getViewType('BreakpointSplitView')!
              // @ts-expect-error
              const snap = await viewType.snapshotFromBreakendFeature({
                feature: row.feature,
                session,
                assemblyName,
              })
              session.addView('BreakpointSplitView', snap)
            } catch (e) {
              console.error(e)
              session.notifyError(`${e}`, e)
            }
          },
        },
      ]}
    >
      <ArrowDropDownIcon />
    </CascadingMenuButton>
  )
}
