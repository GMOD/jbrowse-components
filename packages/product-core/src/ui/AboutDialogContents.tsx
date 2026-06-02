import { Suspense, useState } from 'react'

import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { getConf } from '@jbrowse/core/configuration'
import { PluggableComponent } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import FileInfoPanel from './FileInfoPanel.tsx'
import HeaderButtons from './HeaderButtons.tsx'
import RefNameInfoDialog from './RefNameInfoDialog.tsx'
import { generateDisplayableConfig, readConf } from './util.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

type AboutConfig = AnyConfigurationModel | Record<string, unknown>

interface AboutPanelProps {
  session: AbstractSessionModel
  config: AboutConfig
}

// default for the Core-extraAboutPanel slot: renders nothing. A plugin
// replaces this via PluggableComponent and is responsible for its own
// BaseCard chrome.
function NoAboutPanel(_props: AboutPanelProps) {
  return null
}

const useStyles = makeStyles()({
  content: {
    minWidth: 800,
  },
})

const hideFields = ['displays', 'baseUri', 'refNames', 'formatAbout']

const AboutDialogContents = observer(function AboutDialogContents({
  config,
  session,
}: {
  config: AnyConfigurationModel | Record<string, unknown>
  session: AbstractSessionModel
}) {
  const conf = isStateTreeNode(config) ? getSnapshot(config) : config
  const { classes } = useStyles()
  const [showRefNames, setShowRefNames] = useState(false)

  const hideUris =
    getConf(session, ['formatAbout', 'hideUris']) ||
    readConf(config, ['formatAbout', 'hideUris'])

  const { pluginManager } = getEnv(session)

  const confPostExt = generateDisplayableConfig({
    config,
    session,
    pluginManager,
  })

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
      <Suspense fallback={null}>
        <PluggableComponent
          pluginManager={pluginManager}
          name="Core-extraAboutPanel"
          component={NoAboutPanel}
          props={{ session, config }}
        />
      </Suspense>
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
