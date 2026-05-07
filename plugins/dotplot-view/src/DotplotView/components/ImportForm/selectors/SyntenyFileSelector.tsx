import { FileSelector } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import SwapAssemblies from './SwapAssemblies.tsx'

import type { SelectorProps } from './SelectorTypes.ts'

const SyntenyFileSelector = observer(function SyntenyFileSelector({
  assembly1,
  assembly2,
  swap,
  setSwap,
  fileLocation,
  setFileLocation,
  radioOption,
}: SelectorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <FileSelector
        name={`${radioOption} location`}
        inline
        description=""
        location={fileLocation}
        setLocation={setFileLocation}
      />
      <SwapAssemblies
        assembly1={assembly1}
        assembly2={assembly2}
        swap={swap}
        setSwap={setSwap}
        radioOption={radioOption}
        text1="query assembly"
        text2="target assembly"
      />
    </div>
  )
})

export default SyntenyFileSelector
