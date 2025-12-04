import { useState } from 'react'

import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import FileInfoPanel from './FileInfoPanel'
import HeaderButtons from './HeaderButtons'
import RefNameInfoDialog from './RefNameInfoDialog'
import { generateDisplayableConfig } from './util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  content: {
    minWidth: 800,
  },
})

const AboutDialogContents = observer(function ({
  config,
  session,
}: {
  config: AnyConfigurationModel
  session: AbstractSessionModel
}) {
  const conf = isStateTreeNode(config) ? readConfObject(config) : config
  const { classes } = useStyles()
  const [showRefNames, setShowRefNames] = useState(false)

  const hideUris =
    getConf(session, ['formatAbout', 'hideUris']) ||
    readConfObject(config, ['formatAbout', 'hideUris'])

  const { pluginManager } = getEnv(session)

  const confPostExt = generateDisplayableConfig({
    config,
    session,
    pluginManager,
  })

  const ExtraPanel = pluginManager.evaluateExtensionPoint(
    'Core-extraAboutPanel',
    null,
    { session, config },
  ) as { name: string; Component: React.FC<any> } | null
  const hideFields = ['displays', 'baseUri', 'refNames', 'formatAbout']

  return (
    <div className={classes.content}>
      <BaseCard title="Configuration">
        {!hideUris ? (
          <HeaderButtons conf={conf} setShowRefNames={setShowRefNames} />
        ) : null}
        <Attributes
          attributes={confPostExt.config}
          omit={[...hideFields, 'metadata']}
          hideUris={hideUris}
        />
      </BaseCard>
      {confPostExt.config.metadata ? (
        <BaseCard title="Metadata">
          <Attributes
            attributes={confPostExt.config.metadata}
            omit={hideFields}
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
