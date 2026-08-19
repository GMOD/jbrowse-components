import { useState } from 'react'

import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import {
  getTrackConfigWithPromotables,
  hydrateTrackConfig,
} from '@jbrowse/core/configuration'
import PluggableComponents from '@jbrowse/core/ui/PluggableComponents'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

import FileInfoPanel from './FileInfoPanel.tsx'
import HeaderButtons from './HeaderButtons.tsx'
import RefNameInfoDialog from './RefNameInfoDialog.tsx'
import { getAboutDialogConfig } from './util.ts'

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
  const { classes } = useStyles()
  const [showRefNames, setShowRefNames] = useState(false)

  const { pluginManager } = getEnv(session)

  // "Copy config" output leaves the cascade for good (a user pastes it into a
  // config.json), so promotable slots are resolved rather than left stripped —
  // otherwise the copied config renders differently from the track it came from.
  // `fromDisplayTypeDefaults` names what that folded in, so materializing a
  // session-wide preference into a track config isn't silent.
  //
  // The two menus that open this dialog hand over different things: the in-view
  // track label passes `track.configuration`, a live node, while the
  // hierarchical selector passes a `session.tracks` entry, which is a
  // `types.frozen` plain object until something references the track. Resolving
  // only the first meant the same track copied a different config depending on
  // which menu you came from — and the selector is the one you can reach
  // without opening the track at all. Hydrating converges them; it returns
  // undefined for a config no plugin can build, and that falls back to copying
  // it as authored.
  const live = isStateTreeNode(config)
    ? config
    : hydrateTrackConfig(pluginManager, config)
  const { config: conf, fromDisplayTypeDefaults } = live
    ? getTrackConfigWithPromotables(session, live)
    : { config, fromDisplayTypeDefaults: [] }

  const { config: shown, hideUris } = getAboutDialogConfig({
    config,
    session,
    pluginManager,
  })

  return (
    <div className={classes.content}>
      <BaseCard title="Configuration">
        <HeaderButtons
          conf={conf}
          hideUris={hideUris}
          fromDisplayTypeDefaults={fromDisplayTypeDefaults}
          setShowRefNames={setShowRefNames}
        />
        <Attributes
          attributes={shown}
          omit={[...hideFields, 'metadata']}
          hideUris={hideUris}
        />
      </BaseCard>
      {shown.metadata ? (
        <BaseCard title="Metadata">
          {/* no `hideFields` here: those name config structure, and metadata is
              the user's own key/values — a metadata column called `refNames`
              silently disappeared */}
          <Attributes attributes={shown.metadata} hideUris={hideUris} />
        </BaseCard>
      ) : null}
      <PluggableComponents
        pluginManager={pluginManager}
        /** #extensionPoint Core-extraAboutPanel | sync | Add extra panels to a track's About dialog */
        name="Core-extraAboutPanel"
        props={{ session, config }}
      />
      {/* A file header is a location channel of its own: a BAM's `@SQ UR:` and
          `@PG CL:` carry the server's absolute paths, which is exactly what a
          deployment setting hideUris is trying not to publish. Hiding the
          locations in the config card and then printing them here made the slot
          a half-measure */}
      {hideUris ? null : <FileInfoPanel config={config} session={session} />}
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
