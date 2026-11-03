import { getSession } from '@jbrowse/core/util'
import { Link, List, ListItem, ListSubheader, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { featureLocString, navToFeature } from '../ucscShared.ts'
import { groupHitsByQuery } from './groupHits.ts'
import { hitSummary } from './hitSummary.ts'

import type { UcscHost } from '../ucscShared.ts'
import type { UcscResultsWidgetModel } from './stateModel.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

function plural(count: number, noun: string) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`
}

const HitRow = observer(function HitRow({
  session,
  assembly,
  feature,
  showQuery,
}: {
  session: UcscHost
  assembly: string
  feature: SimpleFeatureSerialized
  showQuery: boolean
}) {
  return (
    <ListItem disableGutters style={{ display: 'block' }}>
      <Link
        href="#"
        onClick={event => {
          event.preventDefault()
          void navToFeature(session, assembly, feature)
        }}
      >
        {featureLocString(feature)}
        {feature.strand === -1 ? ' (-)' : ' (+)'}
      </Link>
      <Typography variant="body2" color="textSecondary">
        {hitSummary(feature, { showQuery })}
      </Typography>
    </ListItem>
  )
})

// The hit list for a BLAT / in-silico PCR query. The query deliberately does not
// navigate (see addResultTrack), so this is where the results become reachable:
// every hit is a link that takes the open view there, best-first, and going to
// one is a click rather than a re-run. A list rather than a table because the
// drawer is narrow and a hit's numbers read fine on one line under its
// coordinates.
const UcscResultsWidget = observer(function UcscResultsWidget({
  model,
}: {
  model: UcscResultsWidgetModel
}) {
  const { features, assembly, trackName, resultNoun, queries } = model
  const session = getSession(model)
  const groups = groupHitsByQuery(features, queries)
  return (
    <div style={{ margin: 12 }}>
      <Typography>
        {`${plural(features.length, resultNoun)} on ${assembly}, added as the track "${trackName}"`}
      </Typography>
      {resultNoun === 'product' && features.length > 1 ? (
        // The reason a bench scientist runs this at all: a second product is a
        // second band, and two of similar size will not resolve. The sizes are on
        // the rows below, so this only has to say to go and read them.
        <Typography variant="body2" color="warning.main">
          These primers amplify more than once, so expect a band per product.
        </Typography>
      ) : null}
      {groups.length > 1 ? (
        groups.map(({ query, hits }) => (
          <List
            key={query}
            dense
            subheader={
              <ListSubheader disableGutters>
                {`${query}: ${hits.length ? plural(hits.length, resultNoun) : `no ${resultNoun}s`}`}
              </ListSubheader>
            }
          >
            {hits.map(feature => (
              <HitRow
                key={feature.uniqueId}
                session={session}
                assembly={assembly}
                feature={feature}
                showQuery={false}
              />
            ))}
          </List>
        ))
      ) : (
        <List dense>
          {features.map(feature => (
            <HitRow
              key={feature.uniqueId}
              session={session}
              assembly={assembly}
              feature={feature}
              showQuery
            />
          ))}
        </List>
      )}
    </div>
  )
})

export default UcscResultsWidget
