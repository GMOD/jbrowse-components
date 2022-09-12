import React, { useState, useEffect } from 'react'
import copy from 'copy-to-clipboard'
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { makeStyles } from 'tss-react/mui'
import { readConfObject, AnyConfigurationModel } from '../configuration'
import { getSession } from '../util'
import { BaseCard, Attributes } from '../BaseFeatureWidget/BaseFeatureDetail'

type FileInfo = Record<string, unknown> | string

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  content: {
    minWidth: 800,
  },
}))

export default function AboutDialog({
  config,
  handleClose,
}: {
  config: AnyConfigurationModel
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [info, setInfo] = useState<FileInfo>()
  const [error, setError] = useState<unknown>()
  const [copied, setCopied] = useState(false)
  const session = getSession(config)
  const { rpcManager } = session
  const conf = readConfObject(config)

  useEffect(() => {
    const aborter = new AbortController()
    const { signal } = aborter
    let cancelled = false
    ;(async () => {
      try {
        const adapterConfig = readConfObject(config, 'adapter')
        const result = await rpcManager.call(config.trackId, 'CoreGetInfo', {
          adapterConfig,
          signal,
        })
        if (!cancelled) {
          setInfo(result as FileInfo)
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e)
          setError(e)
        }
      }
    })()

    return () => {
      aborter.abort()
      cancelled = true
    }
  }, [config, rpcManager])

  let trackName = readConfObject(config, 'name')
  if (readConfObject(config, 'type') === 'ReferenceSequenceTrack') {
    const asm = session.assemblies.find(
      a => a.sequence === config.configuration,
    )

    trackName = asm
      ? `Reference Sequence (${
          readConfObject(asm, 'displayName') || readConfObject(asm, 'name')
        })`
      : 'Reference Sequence'
  }

  const details =
    typeof info === 'string'
      ? {
          header: `<pre>${info
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</pre>`,
        }
      : info || {}

  return (
    <Dialog open onClose={handleClose} maxWidth="xl">
      <DialogTitle>
        {trackName}
        <IconButton
          className={classes.closeButton}
          onClick={() => handleClose()}
          size="large"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className={classes.content}>
        <BaseCard title="Configuration">
          <Button
            variant="contained"
            style={{ float: 'right' }}
            onClick={() => {
              copy(JSON.stringify(conf, null, 2))
              setCopied(true)
              setTimeout(() => setCopied(false), 1000)
            }}
          >
            {copied ? 'Copied to clipboard!' : 'Copy config'}
          </Button>
          <Attributes
            attributes={conf}
            omit={['displays', 'baseUri', 'refNames']}
          />
        </BaseCard>
        {info !== null ? (
          <BaseCard title="File info">
            {error ? (
              <Typography color="error">{`${error}`}</Typography>
            ) : info === undefined ? (
              'Loading file data...'
            ) : (
              <Attributes attributes={details} />
            )}
          </BaseCard>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
