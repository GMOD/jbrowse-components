import { FileSelector } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import SwapAssemblies from './SwapAssemblies'

import type { SelectorProps } from './SelectorTypes'

/**
 * Component for selecting PIF.GZ format files and their indexes
 */
const PifGzSelector = observer(function ({
  assembly1,
  assembly2,
  swap,
  setSwap,
  fileLocation,
  setFileLocation,
  indexFileLocation = undefined,
  setIndexFileLocation = () => {},
  radioOption,
}: SelectorProps) {
  return (
    <div>
      <div style={{ margin: 20 }}>
        Open the {radioOption} and .pif.gz and index file (.pif.gz.tbi or
        .pif.gz.csi) files for created by `jbrowse make-pif`
      </div>
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        <FileSelector
          name={`${radioOption} location`}
          inline
          description=""
          location={fileLocation}
          setLocation={setFileLocation}
        />
        <FileSelector
          name={`${radioOption} index location`}
          inline
          description=""
          location={indexFileLocation}
          setLocation={setIndexFileLocation}
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
    </div>
  )
})

export default PifGzSelector
