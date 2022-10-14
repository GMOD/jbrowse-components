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
import {
  getConf,
  readConfObject,
  AnyConfigurationModel,
} from '../configuration'
import { getSession, getEnv } from '../util'
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

export function FileInfo({ config }: { config: AnyConfigurationModel }) {
  const [error, setError] = useState<unknown>()
  const [info, setInfo] = useState<FileInfo>()
  const session = getSession(config)
  const { rpcManager } = session

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

  const details =
    typeof info === 'string'
      ? {
          header: `<pre>${info
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</pre>`,
        }
      : info || {}

  return info !== null ? (
    <BaseCard title="File info">
      {error ? (
        <Typography color="error">{`${error}`}</Typography>
      ) : info === undefined ? (
        'Loading file data...'
      ) : (
        <Attributes attributes={details} />
      )}
    </BaseCard>
  ) : null
}

export function AboutContents({ config }: { config: AnyConfigurationModel }) {
  const [copied, setCopied] = useState(false)
  const conf = readConfObject(config)
  const session = getSession(config)

  const hideUris =
    getConf(session, ['formatAbout', 'hideUris']) ||
    readConfObject(config, ['formatAbout', 'hideUris'])

  const { pluginManager } = getEnv(session)

  const confPostExt = pluginManager.evaluateExtensionPoint(
    'Core-customizeAbout',
    {
      config: {
        ...conf,
        ...getConf(session, ['formatAbout', 'config'], { config: conf }),
        ...readConfObject(config, ['formatAbout', 'config'], { config: conf }),
      },
    },
    { session, config },
  ) as Record<string, unknown>

  const ExtraPanel = pluginManager.evaluateExtensionPoint(
    'Core-extraAboutPanel',
    null,
    { session, config },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as { name: string; Component: React.FC<any> }

  return (
    <>
      <BaseCard title="Configuration">
        {!hideUris ? (
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
        ) : null}
        <Attributes
          attributes={confPostExt}
          omit={['displays', 'baseUri', 'refNames', 'formatAbout']}
          hideUris={hideUris}
        />
      </BaseCard>
      {ExtraPanel ? (
        <BaseCard title={ExtraPanel.name}>
          <ExtraPanel.Component config={config} />
        </BaseCard>
      ) : null}
      <FileInfo config={config} />
    </>
  )
}

export default function AboutDialog({
  config,
  handleClose,
}: {
  config: AnyConfigurationModel
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const session = getSession(config)
  const trackName = getTrackName(config, session)
  const { pluginManager } = getEnv(session)

  const AboutComponent = pluginManager.evaluateExtensionPoint(
    'Core-replaceAbout',
    AboutContents,
    { session, config },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as React.FC<any>

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
        <AboutComponent config={config} />
      </DialogContent>
    </Dialog>
  )
}
