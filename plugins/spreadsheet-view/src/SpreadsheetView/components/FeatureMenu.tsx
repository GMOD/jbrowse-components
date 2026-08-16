import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { SimpleFeature, assembleLocStringRaw } from '@jbrowse/core/util'
import {
  breakpointSplitViewId,
  hasBreakpointSplitView,
  launchBreakpointSplitView,
} from '@jbrowse/sv-core'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

import { locationLinkClick } from '../util.ts'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'

export default function FeatureMenu({
  assemblyName,
  session,
  spreadsheetViewId,
  feature,
  trackId,
}: {
  spreadsheetViewId: string
  assemblyName: string
  session: AbstractSessionModel
  feature: SimpleFeatureSerialized
  /** the session track for the loaded file; both launches open it */
  trackId?: string
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
                assemblyName,
                session,
                locString: assembleLocStringRaw(feature),
                trackId,
              })
            } catch (e) {
              console.error(e)
              session.notifyError(`${e}`, e)
            }
          },
        },
        // gated like every other launch site: a host that ships the sheet
        // without breakpoint-split-view would otherwise offer a row that opens
        // the choice dialog and fails on `addView` once it is answered
        ...(hasBreakpointSplitView(session)
          ? [
              {
                label: 'Open in breakpoint split view',
                onClick: () => {
                  launchBreakpointSplitView({
                    session,
                    feature: new SimpleFeature(feature),
                    assemblyName,
                    stableViewId: breakpointSplitViewId(
                      spreadsheetViewId,
                      assemblyName,
                    ),
                    ...(trackId ? { defaultTrackIds: [trackId] } : {}),
                  })
                },
              },
            ]
          : []),
      ]}
    >
      <ArrowDropDownIcon />
    </CascadingMenuButton>
  )
}
