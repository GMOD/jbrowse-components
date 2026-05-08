import { FileSelector } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import SwapAssemblies from './SwapAssemblies.tsx'

import type { SelectorProps } from './SelectorTypes.ts'

const StandardFormatSelector = observer(function StandardFormatSelector({
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
        swap={swap}
        radioOption={radioOption}
        assembly1={assembly1}
        assembly2={assembly2}
        setSwap={setSwap}
        text1="query assembly"
        text2="target assembly"
      />
    </div>
  )
})

export default StandardFormatSelector
