import React from 'react'
import { observer } from 'mobx-react'
import { ConfigurationEditor } from '@jbrowse/plugin-config'

const AssemblyEditor = observer(
  ({
    assembly,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assembly: any
  }) => {
    return (
      <div style={{ maxHeight: 600, overflow: 'auto' }}>
        <ConfigurationEditor model={{ target: assembly }} />
      </div>
    )
  },
)

export default AssemblyEditor
