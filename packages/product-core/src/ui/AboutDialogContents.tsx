import { useState } from 'react'

import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { getEnv } from '@jbrowse/core/util'
import { Button } from '@mui/material'
import copy from 'copy-to-clipboard'
import { observer } from 'mobx-react'
import { isStateTreeNode } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

import FileInfoPanel from './FileInfoPanel'
import RefNameInfoDialog from './RefNameInfoDialog'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// locals

const useStyles = makeStyles()({
  content: {
    minWidth: 800,
  },
  button: {
    float: 'right',
  },
})

function removeAttr(obj: Record<string, unknown>, attr: string) {
  for (const prop in obj) {
    if (prop === attr) {
      delete obj[prop]
    } else if (typeof obj[prop] === 'object') {
      removeAttr(obj[prop] as Record<string, unknown>, attr)
    }
  }
  return obj
}

const AboutDialogContents = observer(function ({
  config,
  session,
}: {
  config: AnyConfigurationModel
  session: AbstractSessionModel
}) {
  const [copied, setCopied] = useState(false)
  const conf = isStateTreeNode(config) ? readConfObject(config) : config
  const { classes } = useStyles()
  const [showRefNames, setShowRefNames] = useState(false)

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
  ) as {
    config: { metadata?: Record<string, unknown>; [key: string]: unknown }
  }

  const ExtraPanel = pluginManager.evaluateExtensionPoint(
    'Core-extraAboutPanel',
    null,
    { session, config },
  ) as { name: string; Component: React.FC<any> } | null

  return (
    <div className={classes.content}>
      <BaseCard title="Configuration">
        {!hideUris ? (
          <span className={classes.button}>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                setShowRefNames(true)
              }}
            >
              Show ref names
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                const snap = removeAttr(structuredClone(conf), 'baseUri')
                copy(JSON.stringify(snap, null, 2))
                setCopied(true)
                setTimeout(() => {
                  setCopied(false)
                }, 1000)
              }}
            >
              {copied ? 'Copied to clipboard!' : 'Copy config'}
            </Button>
          </span>
        ) : null}
        <Attributes
          attributes={confPostExt.config}
          omit={['displays', 'baseUri', 'refNames', 'formatAbout', 'metadata']}
          hideUris={hideUris}
        />
      </BaseCard>
      {confPostExt.config.metadata ? (
        <BaseCard title="Metadata">
          <Attributes
            attributes={confPostExt.config.metadata}
            omit={['displays', 'baseUri', 'refNames', 'formatAbout']}
            hideUris={hideUris}
          />
        </BaseCard>
      ) : null}
      {ExtraPanel ? (
        <BaseCard title={ExtraPanel.name}>
          <ExtraPanel.Component config={config} />
        </BaseCard>
      ) : null}
      <FileInfoPanel config={config} session={session} />
      {showRefNames ? (
        <RefNameInfoDialog
          session={session}
          config={config}
          onClose={() => {
            setShowRefNames(false)
          }}
        />
      ) : null}
    </div>
  )
})

export default AboutDialogContents
