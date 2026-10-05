import { useState } from 'react'

import Attributes, {
  hasAttributeRows,
  withoutLocations,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import PluggableComponents from '@jbrowse/core/ui/PluggableComponents'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import AssemblyInfoPanel from './AssemblyInfoPanel.tsx'
import DescriptionPanel from './DescriptionPanel.tsx'
import FileInfoPanel from './FileInfoPanel.tsx'
import HeaderButtons from './HeaderButtons.tsx'
import RefNameInfoDialog from './RefNameInfoDialog.tsx'
import { omitTrackDescription } from './descriptionHtml.ts'
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
  const {
    conf,
    config: shown,
    advanced,
    hideUris,
  } = getAboutDialogConfig({ config, session })
  const advancedShown = hideUris ? withoutLocations(advanced) : advanced

  return (
    <div className={classes.content}>
      <BaseCard title="Configuration">
        <HeaderButtons
          conf={conf}
          hideUris={hideUris}
          setShowRefNames={setShowRefNames}
        />
        <Attributes
          attributes={shown}
          omit={[...hideFields, 'metadata']}
          hideUris={hideUris}
        />
      </BaseCard>
      {hasAttributeRows(advancedShown, hideFields) ? (
        <BaseCard title="Advanced" defaultExpanded={false}>
          <Attributes attributes={advancedShown} omit={hideFields} />
        </BaseCard>
      ) : null}
      {shown.metadata ? (
        <BaseCard title="Metadata">
          {/* no `hideFields` here: those name config structure, and metadata is
              the user's own key/values — a metadata column called `refNames`
              silently disappeared */}
          <Attributes
            attributes={omitTrackDescription(shown.metadata)}
            hideUris={hideUris}
          />
        </BaseCard>
      ) : null}
      <DescriptionPanel config={config} session={session} />
      {/* the assembly a reference sequence track belongs to. That track's own
          config is three slots of adapter, and the interesting half of what a
          user opens it for — the aliases, the cytobands, the assembly's own
          name and aliases — lives one node up, which nothing else in the app
          surfaces */}
      <AssemblyInfoPanel
        config={config}
        session={session}
        hideUris={hideUris}
      />
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
