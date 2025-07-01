import { FileSelector } from '@jbrowse/core/ui'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { SelectorProps } from './SelectorTypes'

const AnchorsFileSelector = observer(function ({
  assembly1,
  assembly2,
  swap,
  setSwap,
  fileLocation,
  setFileLocation,
  bed1Location,
  setBed1Location,
  bed2Location,
  setBed2Location,
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
      <div>
        <FileSelector
          inline
          name={radioOption}
          location={fileLocation}
          setLocation={loc => {
            setFileLocation(loc)
          }}
        />
        <FileSelector
          inline
          name="genome 1 .bed (left column of anchors file)"
          description=""
          location={bed1Location}
          setLocation={loc => {
            if (setBed1Location) {
              setBed1Location(loc)
            }
          }}
        />
        <FileSelector
          inline
          name="genome 2 .bed (right column of anchors file)"
          description=""
          location={bed2Location}
          setLocation={loc => {
            if (setBed2Location) {
              setBed2Location(loc)
            }
          }}
        />
      </div>
      <div
        style={{
          margin: 'auto',
          display: 'flex',
          justifyContent: 'center',
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
  )
})

export default AnchorsFileSelector
