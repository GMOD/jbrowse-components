import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { SimpleFeature, assembleLocStringRaw } from '@jbrowse/core/util'
import {
  breakpointSplitViewId,
  hasBreakpointSplitView,
  launchBreakpointSplitView,
} from '@jbrowse/sv-core'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

import { locationLinkClick } from '../util.ts'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type {
  BreakpointSplitViewHost,
  FindJunctionsNear,
} from '@jbrowse/sv-core'

export default function FeatureMenu({
  assemblyName,
  session,
  spreadsheetViewId,
  feature,
  trackId,
  findJunctionsNear,
}: {
  spreadsheetViewId: string
  assemblyName: string
  session: BreakpointSplitViewHost
  feature: SimpleFeatureSerialized
  /** the session track for the loaded file; both launches open it */
  trackId?: string
  /** the sheet's own read of the callset, which is what offers chain walking */
  findJunctionsNear?: FindJunctionsNear
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
                    // the row menu used to be the one launch site that could
                    // not offer "follow further breakends at each end", for
                    // want of a way to query the callset — while the chord
                    // click, over the same records, could
                    findJunctionsNear,
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
