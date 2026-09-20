import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { SimpleFeature, assembleLocStringRaw } from '@jbrowse/core/util'
import {
  breakpointSplitViewId,
  hasBreakpointSplitView,
  launchBreakpointSplitView,
  pairedEndsLocString,
} from '@jbrowse/sv-core'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

import { locationLinkClick } from '../util.ts'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type {
  BreakpointSplitViewHost,
  FindJunctionsNear,
  SvEvent,
} from '@jbrowse/sv-core'

// either side of each breakpoint when a row's two ends open as one view
const PAIRED_END_WINDOW_BP = 5000

export default function FeatureMenu({
  assemblyName,
  session,
  spreadsheetViewId,
  feature,
  trackIds,
  findJunctionsNear,
  svEventFor,
}: {
  spreadsheetViewId: string
  assemblyName: string
  session: BreakpointSplitViewHost
  feature: SimpleFeatureSerialized
  /** the sheet's `drilldownTrackIds`; both launches open them */
  trackIds: string[]
  /** the sheet's read of the callset; chain walking is offered only with it */
  findJunctionsNear?: FindJunctionsNear
  svEventFor: (feature: SimpleFeatureSerialized) => SvEvent | undefined
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
                locString:
                  pairedEndsLocString(
                    new SimpleFeature(feature),
                    PAIRED_END_WINDOW_BP,
                  ) ?? assembleLocStringRaw(feature),
                trackIds,
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
                    defaultTrackIds: trackIds,
                    // the row menu used to be the one launch site that could
                    // not offer "follow further breakends at each end", for
                    // want of a way to query the callset — while the chord
                    // click, over the same records, could
                    findJunctionsNear,
                    event: svEventFor(feature),
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
