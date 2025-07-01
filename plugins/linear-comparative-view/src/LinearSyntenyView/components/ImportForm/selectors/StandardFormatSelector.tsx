import { FileSelector } from '@jbrowse/core/ui'
import HelpIcon from '@mui/icons-material/Help'
import { Button, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { helpStrings } from './SelectorTypes'

import type { SelectorProps } from './SelectorTypes'

/**
 * Component for selecting PAF, OUT, DELTA, or CHAIN format files
 */
const StandardFormatSelector = observer(function ({
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
        <div
          style={{
            display: 'flex',
            gap: 20,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 4,
              alignItems: 'center',
            }}
          >
            <div>
              <i>{swap ? assembly2 : assembly1}</i>
            </div>
            <div>query assembly</div>
            <div>
              <i>{swap ? assembly1 : assembly2}</i>
            </div>
            <div>target assembly</div>
          </div>
          <Button
            variant="contained"
            onClick={() => {
              if (setSwap) {
                setSwap(!swap)
              }
            }}
          >
            Swap?
          </Button>
        </div>
      </div>
    </div>
  )
})

export default StandardFormatSelector
