import { Suspense, useState } from 'react'

import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { getConf } from '@jbrowse/core/configuration'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import FileInfoPanel from './FileInfoPanel.tsx'
import HeaderButtons from './HeaderButtons.tsx'
import RefNameInfoDialog from './RefNameInfoDialog.tsx'
import { getAboutDialogConfig, readConfSlot } from './util.ts'

import type { AboutPanelProps } from './util.ts'

const useStyles = makeStyles()({
  content: {
    minWidth: 800,
  },
})

const hideFields = ['displays', 'baseUri', 'refNames', 'formatAbout']

const AboutDialogContents = observer(function AboutDialogContents({
  config,
  session,
}: AboutPanelProps) {
  const conf = isStateTreeNode(config) ? getSnapshot(config) : config
  const { classes } = useStyles()
  const [showRefNames, setShowRefNames] = useState(false)

  const hideUris = Boolean(
    getConf(session, ['formatAbout', 'hideUris']) ||
    readConfSlot<boolean>(config, ['formatAbout', 'hideUris']),
  )

  const { pluginManager } = getEnv(session)

  const confPostExt = getAboutDialogConfig({
    config,
    session,
    pluginManager,
  })

  // each registered panel scopes itself (returns null when it doesn't apply)
  // and owns its own BaseCard chrome
  const extraPanels = [
    /** #extensionPoint Core-extraAboutPanel | sync | Add extra panels to a track's About dialog */
    pluginManager.evaluateExtensionPoint('Core-extraAboutPanel', [], {
      session,
      config,
    }),
  ].flat()

  return (
    <div className={classes.content}>
      <BaseCard title="Configuration">
        <HeaderButtons
          conf={conf}
          hideUris={hideUris}
          setShowRefNames={setShowRefNames}
        />
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
      {extraPanels.map((Panel, i) => (
        <Suspense
          // eslint-disable-next-line @eslint-react/no-array-index-key -- panels are registration-ordered, stable across renders
          key={i}
          fallback={null}
        >
          <Panel session={session} config={config} />
        </Suspense>
      ))}
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
