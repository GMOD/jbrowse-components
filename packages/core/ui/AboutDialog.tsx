import React, { useState, useEffect } from 'react'
import { getEnv } from 'mobx-state-tree'
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
import {
  getConf,
  readConfObject,
  AnyConfigurationModel,
} from '../configuration'
import { getSession } from '../util'
import { getTrackName } from '../util/tracks'
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
  const hideUris =
    readConfObject(config, ['formatAbout', 'hideUris']) ||
    getConf(session, ['formatAbout', 'hideUris'])

  const confPost = {
    ...conf,
    ...readConfObject(config, ['formatAbout', 'conf'], { conf }),
    ...getConf(session, ['formatAbout', 'conf'], { conf }),
  }

  const { pluginManager } = getEnv(session)
  pluginManager.evaluateExtensionPoist('Core-customizeAbout', confPost, {
    session,
  })

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

  const trackName = getTrackName(config, session)

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
          {!hideUris ? (
            <Button
              variant="contained"
              style={{ float: 'right' }}
              onClick={() => {
                copy(JSON.stringify(confPost, null, 2))
                setCopied(true)
                setTimeout(() => setCopied(false), 1000)
              }}
            >
              {copied ? 'Copied to clipboard!' : 'Copy config'}
            </Button>
          ) : null}
          <Attributes
            attributes={confPost}
            omit={['displays', 'baseUri', 'refNames', 'formatAbout']}
            hideUris={hideUris}
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
