import { FileSelector } from '@jbrowse/core/ui'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { SelectorProps } from './SelectorTypes'

/**
 * Component for selecting ANCHORS format files and their related BED files
 */
const AnchorsSelector = observer(function ({
  assembly1,
  assembly2,
  swap,
  setSwap,
  fileLocation,
  setFileLocation,
  bed1Location = undefined,
  setBed1Location = () => {},
  bed2Location = undefined,
  setBed2Location = () => {},
  radioOption,
}: SelectorProps) {
  return (
    <div>
      <div style={{ margin: 20 }}>
        Open the {radioOption} and .bed files for both genome assemblies from
        the MCScan (Python version) pipeline{' '}
        <a href="https://github.com/tanghaibao/jcvi/wiki/MCscan-(Python-version)">
          (more info)
        </a>
      </div>
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        <FileSelector
          inline
          name={radioOption}
          location={fileLocation}
          setLocation={setFileLocation}
        />
        <FileSelector
          inline
          name="genome 1 .bed (left column of anchors file)"
          description=""
          location={bed1Location}
          setLocation={setBed1Location}
        />
        <FileSelector
          inline
          name="genome 2 .bed (right column of anchors file)"
          description=""
          location={bed2Location}
          setLocation={setBed2Location}
        />

        <div>
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
            <div>bed1 assembly</div>
            <div>
              <i>{swap ? assembly1 : assembly2}</i>
            </div>
            <div>bed2 assembly</div>
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

export default AnchorsSelector
