import { useState } from 'react'

import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { getEnv, getSession } from '@jbrowse/core/util'
import { Button } from '@mui/material'
import copy from 'copy-to-clipboard'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import FileInfoPanel from './FileInfoPanel'
import RefNameInfoDialog from './RefNameInfoDialog'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import AssemblyRefNameInfoDialog from './AssemblyRefNameInfoDialog'

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

const AssemblyAboutDialogContents = observer(function ({
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
    'Core-customizeAssemblyAbout',
    {
      config: {
        ...conf,
        ...getConf(session, ['formatAbout', 'config'], { config: conf }),
        ...readConfObject(config, ['formatAbout', 'config'], { config: conf }),
      },
    },
    {
      session,
      config,
    },
  ) as {
    config: {
      sequence: {
        metadata?: Record<string, unknown>
        [key: string]: unknown
      }
    }
  }

  const { sequence, ...rest } = confPostExt.config
  const { metadata, ...configPostExtSelection } = sequence

  const ExtraPanel = pluginManager.evaluateExtensionPoint(
    'Core-extraAssemblyAboutPanel',
    null,
    {
      session,
      config,
    },
  ) as {
    name: string
    Component: React.FC<any>
  } | null

  return (
    <div className={classes.content}>
      <BaseCard title="Assembly">
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
        <Attributes attributes={rest} />
      </BaseCard>
      {metadata ? (
        <BaseCard title="Metadata">
          <Attributes
            attributes={metadata}
            omit={['displays', 'baseUri', 'refNames', 'formatAbout']}
            hideUris={hideUris}
          />
        </BaseCard>
      ) : null}
      <BaseCard title="Configuration">
        <Attributes
          attributes={configPostExtSelection}
          omit={['displays', 'baseUri', 'refNames', 'formatAbout', 'metadata']}
          hideUris={hideUris}
        />
      </BaseCard>

      {ExtraPanel ? (
        <BaseCard title={ExtraPanel.name}>
          <ExtraPanel.Component config={config} />
        </BaseCard>
      ) : null}

      <FileInfoPanel config={config.sequence} />
      {showRefNames ? (
        <AssemblyRefNameInfoDialog
          config={config}
          onClose={() => {
            setShowRefNames(false)
          }}
        />
      ) : null}
    </div>
  )
})

export default AssemblyAboutDialogContents
