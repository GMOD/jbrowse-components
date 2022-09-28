import React, { useEffect, useState } from 'react'
import { openLocation } from '@jbrowse/core/util/io'
import { HubFile } from '@gmod/ucsc-hub'
import {
  Card,
  CardActions,
  CardContent,
  CardHeader,
  IconButton,
  LinearProgress,
  Typography,
} from '@mui/material'
import EmailIcon from '@mui/icons-material/Email'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { SanitizedHTML } from '@jbrowse/core/ui'

function HubDetails(props: {
  hub: { url: string; longLabel: string; shortLabel: string }
}) {
  const [hubFile, setHubFile] = useState<Map<string, string>>()
  const [error, setError] = useState<unknown>()

  const { hub } = props

  const { url: hubUrl, longLabel, shortLabel } = hub

  useEffect(() => {
    async function getHubTxt() {
      try {
        const hubHandle = openLocation({
          uri: hubUrl,
          locationType: 'UriLocation',
        })
        const hubTxt = await hubHandle.readFile('utf8')
        const newHubFile = new HubFile(hubTxt)
        setHubFile(newHubFile)
      } catch (error) {
        console.error(error)
        setError(error)
      }
    }

    getHubTxt()
  }, [hubUrl])

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">{`${error}`}</Typography>
        </CardContent>
      </Card>
    )
  }
  if (hubFile) {
    return (
      <Card>
        <CardHeader title={shortLabel} />
        <CardContent>
          <SanitizedHTML html={longLabel} />
        </CardContent>
        <CardActions>
          <IconButton
            href={`mailto:${hubFile.get('email')}`}
            rel="noopener noreferrer"
            target="_blank"
            color="secondary"
          >
            <EmailIcon />
          </IconButton>
          {hubFile.get('descriptionUrl') ? (
            <IconButton
              href={
                new URL(hubFile.get('descriptionUrl') || '', new URL(hubUrl))
                  .href
              }
              rel="noopener noreferrer"
              target="_blank"
            >
              <OpenInNewIcon color="secondary" />
            </IconButton>
          ) : null}
        </CardActions>
      </Card>
    )
  }
  return <LinearProgress variant="query" />
}

export default HubDetails
