import { FileSelector } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import SwapAssemblies from './SwapAssemblies'

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
    </div>
  )
})

export default AnchorsSelector
