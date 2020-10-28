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
    return <ConfigurationEditor model={{ target: assembly }} />
  },
)

export default AssemblyEditor
