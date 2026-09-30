import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { readConfObject } from '@jbrowse/core/configuration'
import { ErrorBanner, LoadingEllipses, SanitizedHTML } from '@jbrowse/core/ui'
import { openLocation } from '@jbrowse/core/util/io'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { Link, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import {
  getTrackDescription,
  rebaseDescriptionHtml,
} from './descriptionHtml.ts'

import type { AboutPanelProps } from './util.ts'
import type { ReactNode } from 'react'

const useStyles = makeStyles()(theme => ({
  provenance: {
    marginBottom: theme.spacing(1),
  },
  prose: {
    display: 'block',
    '& h1, & h2': {
      fontSize: theme.typography.pxToRem(16),
      fontWeight: theme.typography.fontWeightBold,
      margin: theme.spacing(2, 0, 0.5),
    },
    '& h3, & h4': {
      fontSize: theme.typography.pxToRem(14),
      fontWeight: theme.typography.fontWeightBold,
      margin: theme.spacing(1.5, 0, 0.5),
    },
    '& > :first-child': {
      marginTop: 0,
    },
    '& p': {
      margin: theme.spacing(0, 0, 1),
    },
    '& table': {
      borderCollapse: 'collapse',
      margin: theme.spacing(1, 0),
    },
    '& th, & td': {
      padding: theme.spacing(0.25, 1),
      border: `1px solid ${theme.palette.divider}`,
    },
    '& img': {
      maxWidth: '100%',
    },
  },
}))

function Prose({ html }: { html: string }) {
  const { classes } = useStyles()
  return <SanitizedHTML html={html} className={classes.prose} />
}

function DescriptionCard({
  url,
  children,
}: {
  url?: string
  children: ReactNode
}) {
  const { classes } = useStyles()
  return (
    <BaseCard title="Description">
      <Typography
        variant="caption"
        color="textSecondary"
        component="div"
        className={classes.provenance}
      >
        The track&apos;s description, written for the UCSC Genome Browser — some
        display options it describes differ in JBrowse.
        {url ? (
          <>
            {' '}
            <Link href={url} target="_blank" rel="noopener noreferrer">
              View original
            </Link>
          </>
        ) : null}
      </Typography>
      {children}
    </BaseCard>
  )
}

const FetchedDescription = observer(function FetchedDescription({
  url,
}: {
  url: string
}) {
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
    <DescriptionCard url={url}>
      {error ? (
        <ErrorBanner error={error} />
      ) : isLoading || html === undefined ? (
        <LoadingEllipses message="Loading description" />
      ) : (
        <Prose html={html} />
      )}
    </DescriptionCard>
  )
})

const DescriptionPanel = observer(function DescriptionPanel({
  config,
}: AboutPanelProps) {
  const description = getTrackDescription(readConfObject(config, 'metadata'))

  return !description ? null : 'url' in description ? (
    <FetchedDescription url={description.url} />
  ) : (
    <DescriptionCard>
      <Prose html={description.html} />
    </DescriptionCard>
  )
})

export default DescriptionPanel
