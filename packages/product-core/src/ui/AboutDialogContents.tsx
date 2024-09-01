import React, { useState } from 'react'
import { observer } from 'mobx-react'
import clone from 'clone'
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
import RefNameInfoDialog from './RefNameInfoDialog'

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
}: {
  config: AnyConfigurationModel
}) {
  const [copied, setCopied] = useState(false)
  const conf = readConfObject(config)
  const session = getSession(config)
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
  ) as Record<string, unknown>

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
                const snap = removeAttr(clone(conf), 'baseUri')
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
      {showRefNames ? (
        <RefNameInfoDialog
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
