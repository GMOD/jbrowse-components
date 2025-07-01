import { FileSelector } from '@jbrowse/core/ui'
import HelpIcon from '@mui/icons-material/Help'
import { Button, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { helpStrings } from './SelectorTypes'

import type { SelectorProps } from './SelectorTypes'

const useStyles = makeStyles()({
  row: {
    display: 'flex',
    gap: 20,
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  swap: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 4,
    alignItems: 'center',
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
      <div>
        <div>
          Verify or click swap
          <Tooltip
            title={
              <code>
                {helpStrings[radioOption as keyof typeof helpStrings]}
              </code>
            }
          >
            <HelpIcon />
          </Tooltip>
        </div>
        <div className={classes.row}>
          <div className={classes.swap}>
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

export default SyntenyFileSelector
