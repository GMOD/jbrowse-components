import React from 'react'
import { observer } from 'mobx-react'
import { ConfigurationEditor } from '../configEditor'

const AssemblyEditor = observer(
  ({
    assembly,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assembly: any
  }) => {
    return <ConfigurationEditor target={assembly} />
  },
)

export default AssemblyEditor
