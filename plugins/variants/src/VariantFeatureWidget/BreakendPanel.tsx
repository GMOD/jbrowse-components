/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react'
import { Link, Typography } from '@mui/material'
import SimpleFeature, {
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'
import { getEnv, getSession } from '@jbrowse/core/util'
import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import BreakendOptionDialog from './BreakendOptionDialog'

export default function BreakendPanel(props: {
  locStrings: string[]
  model: any
  feature: SimpleFeatureSerialized
}) {
  const { model, locStrings, feature } = props
  const session = getSession(model)
  const { pluginManager } = getEnv(session)
  const [breakpointDialog, setBreakpointDialog] = useState(false)
  let viewType

  try {
    viewType = pluginManager.getViewType('BreakpointSplitView')
  } catch (e) {
    // ignore
  }

  const simpleFeature = new SimpleFeature(feature)
  return (
    <BaseCard {...props} title="Breakends">
      <Typography>Link to linear view of breakend endpoints</Typography>
      <ul>
        {locStrings.map(locString => (
          <li key={`${JSON.stringify(locString)}`}>
            <Link
              href="#"
              onClick={event => {
                event.preventDefault()
                const { view } = model
                try {
                  if (view) {
                    view.navToLocString?.(locString)
                  } else {
                    throw new Error(
                      'No view associated with this feature detail panel anymore',
                    )
                  }
                } catch (e) {
                  console.error(e)
                  session.notify(`${e}`)
                }
              }}
            >
              {`LGV - ${locString}`}
            </Link>
          </li>
        ))}
      </ul>
      {viewType ? (
        <div>
          <Typography>
            Launch split views with breakend source and target
          </Typography>
          <ul>
            {locStrings.map(locString => (
              <li key={`${JSON.stringify(locString)}`}>
                <Link
                  href="#"
                  onClick={event => {
                    event.preventDefault()
                    setBreakpointDialog(true)
                  }}
                >
                  {`${feature.refName}:${feature.start} // ${locString} (split view)`}
                </Link>
              </li>
            ))}
          </ul>
          {breakpointDialog ? (
            <BreakendOptionDialog
              model={model}
              feature={simpleFeature}
              viewType={viewType}
              handleClose={() => {
                setBreakpointDialog(false)
              }}
            />
          ) : null}
        </div>
      ) : null}
    </BaseCard>
  )
}
