import { useEffect, useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getConfAssemblyNames } from '@jbrowse/core/util/tracks'
import { Button, DialogContent } from '@mui/material'
import copy from 'copy-to-clipboard'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const MAX_REF_NAMES = 10_000

const useStyles = makeStyles()(theme => ({
  container: {
    minWidth: 800,
  },
  refNames: {
    maxHeight: 300,
    overflow: 'auto',
    flexGrow: 1,
    background: theme.palette.background.default,
  },
}))

const AssemblyRefNameInfoDialog = observer(function ({
  config,
  onClose,
}: {
  config: AnyConfigurationModel
  onClose: () => void
}) {
  const { classes } = useStyles()
  const [copied, setCopied] = useState(false)
  const { assemblyManager } = getSession(config)
  const assemblyName = config.name
  const assembly = assemblyManager.get(assemblyName)
  const regions = assemblyManager.get(config.name)?.regions
  const refNames = regions?.map(r => r.refName as string)
  const names = refNames ?? []
  const result = [
    `--- ${assemblyName} ---`,
    ...names,
    names.length > MAX_REF_NAMES
      ? `\nToo many refNames to show in browser for ${assemblyName}, use "Copy ref names" button to copy to clipboard`
      : '',
  ].join('\n')

  return (
    <Dialog
      open
      title="Reference sequence names used in track"
      onClose={onClose}
      maxWidth="xl"
    >
      <DialogContent className={classes.container}>
        {refNames === undefined ? (
          <LoadingEllipses message="Loading refNames" />
        ) : (
          <>
            <Button
              variant="contained"
              onClick={() => {
                copy([`--- ${assemblyName} ---`, ...names].join('\n'))
                setCopied(true)
                setTimeout(() => {
                  setCopied(false)
                }, 1000)
              }}
            >
              {copied ? 'Copied to clipboard!' : 'Copy ref names'}
            </Button>

            <pre className={classes.refNames}>{result}</pre>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
})

export default AssemblyRefNameInfoDialog
