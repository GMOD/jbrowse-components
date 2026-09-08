import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { ErrorBanner, LoadingEllipses, SanitizedHTML } from '@jbrowse/core/ui'
import { openLocation } from '@jbrowse/core/util/io'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { Link, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import {
  getDescriptionHtmlUrl,
  rebaseDescriptionHtml,
} from './descriptionHtml.ts'

import type { AboutPanelProps } from './util.ts'

const useStyles = makeStyles()(theme => ({
  provenance: {
    marginBottom: theme.spacing(1),
  },
}))

const DescriptionCard = observer(function DescriptionCard({
  url,
}: {
  url: string
}) {
  const { classes } = useStyles()
  const {
    data: html,
    error,
    isLoading,
  } = useFetch(['trackDescriptionHtml', url] as const, async (_name, url) =>
    rebaseDescriptionHtml(
      await openLocation({ uri: url, locationType: 'UriLocation' }).readFile(
        'utf8',
      ),
      url,
    ),
  )

  return (
    <BaseCard title="Description">
      {/* the page is the UCSC Genome Browser's, and describes display options
          JBrowse does not follow slot for slot, so the card says whose it is */}
      <Typography
        variant="caption"
        color="textSecondary"
        component="div"
        className={classes.provenance}
      >
        From the track hub, written for the UCSC Genome Browser — some display
        options it describes differ in JBrowse.{' '}
        <Link href={url} target="_blank" rel="noopener noreferrer">
          View original
        </Link>
      </Typography>
      {error ? (
        <ErrorBanner error={error} />
      ) : isLoading || html === undefined ? (
        <LoadingEllipses message="Loading description" />
      ) : (
        <SanitizedHTML html={html} />
      )}
    </BaseCard>
  )
})

const DescriptionPanel = observer(function DescriptionPanel({
  config,
}: AboutPanelProps) {
  const url = getDescriptionHtmlUrl(config)

  return url ? <DescriptionCard url={url} /> : null
})

export default DescriptionPanel
