import { openLocation } from '@gmod/jbrowse-core/util/io'
import { HubFile } from '@gmod/ucsc-hub'
import Card from '@material-ui/core/Card'
import CardActions from '@material-ui/core/CardActions'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import IconButton from '@material-ui/core/IconButton'
import LinearProgress from '@material-ui/core/LinearProgress'
import Typography from '@material-ui/core/Typography'
import EmailIcon from '@material-ui/icons/Email'
import OpenInNewIcon from '@material-ui/icons/OpenInNew'
import PropTypes from 'prop-types'
import DOMPurify from 'dompurify'
import React, { useEffect, useState } from 'react'

function HubDetails(props) {
  const [hubFile, setHubFile] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  const { hub } = props

  const { url: hubUrl, longLabel, shortLabel } = hub

  useEffect(() => {
    async function getHubTxt() {
      let hubTxt
      try {
        const hubHandle = openLocation({ uri: hubUrl })
        hubTxt = await hubHandle.readFile('utf8')
      } catch (error) {
        setErrorMessage(
          <span>
            <strong>Error retrieving hub</strong> {error.message} <br />
            {hubUrl}
          </span>,
        )
        return
      }
      try {
        const newHubFile = new HubFile(hubTxt)
        setHubFile(newHubFile)
      } catch (error) {
        setErrorMessage(
          <span>
            <strong>Could not parse genomes file:</strong> <br />
            {error.message} <br />
            {hubUrl}
          </span>,
        )
      }
    }

    getHubTxt()
  }, [hubUrl])
  if (errorMessage)
    return (
      <Card>
        <CardContent>
          <Typography color="error">{errorMessage}</Typography>
        </CardContent>
      </Card>
    )
  if (hubFile)
    return (
      <Card>
        <CardHeader title={shortLabel} />
        <CardContent>
          <div __dangerouslySetInnerHTML={DOMPurify.sanitize(longLabel)} />
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
                new URL(hubFile.get('descriptionUrl'), new URL(hubUrl)).href
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
  return <LinearProgress variant="query" />
}

HubDetails.propTypes = {
  hub: PropTypes.shape().isRequired,
}

export default HubDetails
