import React, { useState } from 'react'
import copy from 'copy-to-clipboard'
import { Button } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import {
  getConf,
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import { getSession, getEnv } from '@jbrowse/core/util'
import {
  BaseCard,
  Attributes,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import FileInfoPanel from './FileInfoPanel'

const useStyles = makeStyles()({
  content: {
    minWidth: 800,
  },
})

export default function AboutContents({
  config,
}: {
  config: AnyConfigurationModel
}) {
  const [copied, setCopied] = useState(false)
  const conf = readConfObject(config)
  const session = getSession(config)
  const { classes } = useStyles()

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
    <div className={classes.content}>
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
      <FileInfoPanel config={config} />
    </div>
  )
}
