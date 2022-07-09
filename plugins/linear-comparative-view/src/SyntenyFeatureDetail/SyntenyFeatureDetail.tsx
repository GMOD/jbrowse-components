import React, { useState } from 'react'
import copy from 'copy-to-clipboard'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'
import {
  BaseCoreDetails,
  BaseAttributes,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

function Formatter({ value }: { value: unknown }) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const display = String(value)
  if (display.length > 100) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            copy(display)
            setCopied(true)
            setTimeout(() => {
              setCopied(false)
            }, 700)
          }}
        >
          {copied ? 'Copied to clipboard' : 'Copy'}
        </button>
        <button type="button" onClick={() => setShow(val => !val)}>
          {show ? 'Show less' : 'Show more'}
        </button>
        <div>{show ? display : `${display.slice(0, 100)}...`}</div>
      </>
    )
  }
  return <div>{display}</div>
}

function CustomFeatureDetails(props: { feature: SimpleFeatureSerialized }) {
  return (
    <BaseAttributes
      {...props}
      formatter={(value: unknown) => <Formatter value={value} />}
    />
  )
}

const BreakpointAlignmentsFeatureDetail = observer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ model }: { model: any }) => {
    const { feature1, feature2 } = JSON.parse(JSON.stringify(model.featureData))
    return (
      <Paper data-testid="alignment-side-drawer">
        <BaseCoreDetails title="Feature 1" feature={feature1} />
        <BaseCoreDetails title="Feature 2" feature={feature2} />
        <CustomFeatureDetails feature={feature1} />
        <CustomFeatureDetails feature={feature2} />
      </Paper>
    )
  },
)

export default BreakpointAlignmentsFeatureDetail
