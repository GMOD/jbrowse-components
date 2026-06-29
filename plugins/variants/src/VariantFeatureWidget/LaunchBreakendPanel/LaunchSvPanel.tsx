import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { ActionLink } from '@jbrowse/core/ui'
import {
  SimpleFeature,
  assembleLocString,
  getBpDisplayStr,
  getSession,
} from '@jbrowse/core/util'
import {
  getAssemblyName,
  hasBreakpointSplitView,
  launchBreakpointSplitView,
  navToLoc,
} from '@jbrowse/sv-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { VariantFeatureWidgetModel } from '../stateModelFactory.ts'
import type { VCFFeatureSerialized } from '../types.ts'

// The breakpoint split view shows each end of a variant in its own panel, which
// only helps once the span is too wide to inspect both ends at once in a single
// linear view. Short variants (e.g. a 50bp deletion) fit on screen, so we just
// offer a "zoom to" link instead.
const splitViewMinSpan = 10_000

const LaunchSvPanel = observer(function LaunchSvPanel({
  model,
  feature,
}: {
  model: VariantFeatureWidgetModel
  feature: VCFFeatureSerialized
}) {
  const assemblyName = getAssemblyName(model.view)
  const { refName, start, end, type = 'variant' } = feature
  const length = end - start
  const locString = assembleLocString({ refName, start, end })
  return assemblyName ? (
    <BaseCard title="Launch views">
      <Typography>
        {`${type} at ${locString}, spanning ${getBpDisplayStr(length)}`}
      </Typography>
      <ul>
        <li>
          <ActionLink
            onClick={() => {
              navToLoc(locString, model)
            }}
          >
            Zoom to variant in linear view
          </ActionLink>
        </li>
        {length >= splitViewMinSpan && hasBreakpointSplitView(model) ? (
          <li>
            <ActionLink
              onClick={() => {
                launchBreakpointSplitView({
                  session: getSession(model),
                  view: model.view,
                  assemblyName,
                  feature: new SimpleFeature({
                    uniqueId: 'sv',
                    refName,
                    start,
                    end: start + 1,
                    mate: { refName, start: end, end: end + 1 },
                  }),
                  stableViewId: `${model.id}_${assemblyName}_breakpointsplitview`,
                })
              }}
            >
              Open breakpoints in split view
            </ActionLink>
          </li>
        ) : null}
      </ul>
    </BaseCard>
  ) : null
})

export default LaunchSvPanel
