import { FileSelector } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import SwapAssemblies from './SwapAssemblies'

import type { SelectorProps } from './SelectorTypes'

const useStyles = makeStyles()({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
})

const SyntenyFileSelector = observer(function ({
  assembly1,
  assembly2,
  swap,
  setSwap,
  fileLocation,
  setFileLocation,
  radioOption,
}: SelectorProps) {
  const { classes } = useStyles()
  return (
    <div className={classes.container}>
      <FileSelector
        name={`${radioOption} location`}
        inline
        description=""
        location={fileLocation}
        setLocation={loc => {
          setFileLocation(loc)
        }}
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
