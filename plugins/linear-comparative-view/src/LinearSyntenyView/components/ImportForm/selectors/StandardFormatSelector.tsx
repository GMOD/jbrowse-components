import { FileSelector } from '@jbrowse/core/ui'
import HelpIcon from '@mui/icons-material/Help'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { helpStrings } from './SelectorTypes'
import SwapAssemblies from './SwapAssemblies'

import type { SelectorProps } from './SelectorTypes'

/**
 * Component for selecting PAF, OUT, DELTA, or CHAIN format files
 */
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <FileSelector
        name={`${radioOption} location`}
        inline
        description=""
        location={fileLocation}
        setLocation={setFileLocation}
      />
      <div>
        <div>
          Verify or click swap
          <Tooltip title={<code>{helpStrings[radioOption]}</code>}>
            <HelpIcon />
          </Tooltip>
        </div>
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
    </div>
  )
})

export default StandardFormatSelector
