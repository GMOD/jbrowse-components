import { FileSelector } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import SwapAssemblies from './SwapAssemblies.tsx'

import type { SelectorProps } from './SelectorTypes.ts'

const AnchorsFileSelector = observer(function AnchorsFileSelector({
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
      <SwapAssemblies
        swap={swap}
        radioOption={radioOption}
        assembly1={assembly1}
        assembly2={assembly2}
        setSwap={setSwap}
        text1="bed 1 assembly"
        text2="bed 2 assembly"
      />
    </div>
  )
})

export default AnchorsFileSelector
