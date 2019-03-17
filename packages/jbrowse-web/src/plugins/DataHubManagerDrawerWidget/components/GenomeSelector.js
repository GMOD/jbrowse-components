import { GenomesFile } from '@gmod/ucsc-hub'
import Card from '@material-ui/core/Card'
import CardActions from '@material-ui/core/CardActions'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import FormControl from '@material-ui/core/FormControl'
import FormHelperText from '@material-ui/core/FormHelperText'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import InputLabel from '@material-ui/core/InputLabel'
import LinearProgress from '@material-ui/core/LinearProgress'
import MenuItem from '@material-ui/core/MenuItem'
import Select from '@material-ui/core/Select'
import Typography from '@material-ui/core/Typography'
import PropTypes from 'prop-types'
import React, { useState, useEffect } from 'react'

function GenomeSelector(props) {
  const [errorMessage, setErrorMessage] = useState(null)
  const [genomesFile, setGenomesFile] = useState(null)
  const [selectedGenome, setSelectedGenome] = useState('')

  const {
    enableNext,
    hubTxt,
    hubTxtUrl,
    setTrackDbUrl,
    setAssemblyName,
  } = props

  useEffect(() => {
    if (!genomesFile) getGenomesFile()
    if (genomesFile && !selectedGenome)
      handleSelect(Array.from(genomesFile.values())[0].get('genome'))
  })

  async function getGenomesFile() {
    const genomesFileUrl = new URL(hubTxt.get('genomesFile'), hubTxtUrl)
    let response
    try {
      response = await fetch(genomesFileUrl)
    } catch (error) {
      setErrorMessage(
        <span>
          <strong>Network error.</strong> {error.message} <br />
          {genomesFileUrl.href}
        </span>,
      )
      return
    }
    if (!response.ok) {
      setErrorMessage(
        <span>
          <strong>Could not access genomes file:</strong> <br />
          {genomesFileUrl.href} <br />
          {response.status}: {response.statusText}
        </span>,
      )
      return
    }
    const responseText = await response.text()
    let newGenomesFile = genomesFile
    try {
      newGenomesFile = new GenomesFile(responseText)
    } catch (error) {
      setErrorMessage(
        <span>
          <strong>Could not parse genomes file:</strong> <br />
          {error.message} <br />
          {genomesFileUrl.href}
        </span>,
      )
      return
    }
    setGenomesFile(newGenomesFile)
  }

  function handleSelect(genomeName) {
    setSelectedGenome(genomeName)
    const trackDbUrl = genomesFile.get(genomeName).get('trackDb')
    setTrackDbUrl(
      new URL(trackDbUrl, new URL(hubTxt.get('genomesFile'), hubTxtUrl)),
    )
    setAssemblyName(genomesFile.get(genomeName).get('genome'))
    enableNext()
  }

  if (errorMessage)
    return (
      <Card>
        <CardContent>
          <Typography color="error">{errorMessage}</Typography>
        </CardContent>
      </Card>
    )
  if (genomesFile)
    return (
      <Card>
        <CardHeader
          title={hubTxt.get('shortLabel')}
          subheader={hubTxt.get('longLabel')}
        />
        <CardContent>
          <FormControl>
            <InputLabel>Genome</InputLabel>
            <Select
              value={selectedGenome}
              onChange={event => handleSelect(event.target.value)}
            >
              {Array.from(genomesFile.values()).map(genome => {
                const genomeName = genome.get('genome')
                return (
                  <MenuItem key={genomeName} value={genomeName}>
                    {genomeName}
                  </MenuItem>
                )
              })}
            </Select>
            <FormHelperText>Genomes available in this hub</FormHelperText>
          </FormControl>
        </CardContent>
        <CardActions>
          <IconButton
            href={`mailto:${hubTxt.get('email')}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Icon>email</Icon>
          </IconButton>
          {hubTxt.get('descriptionUrl') ? (
            <IconButton
              href={new URL(hubTxt.get('descriptionUrl'), hubTxtUrl).href}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Icon>open_in_new</Icon>
            </IconButton>
          ) : null}
        </CardActions>
      </Card>
    )
  return <LinearProgress variant="query" />
}

GenomeSelector.propTypes = {
  hubTxtUrl: PropTypes.instanceOf(URL).isRequired,
  hubTxt: PropTypes.instanceOf(Map).isRequired,
  enableNext: PropTypes.func,
  setTrackDbUrl: PropTypes.func.isRequired,
  setAssemblyName: PropTypes.func.isRequired,
}

GenomeSelector.defaultProps = {
  enableNext: () => {},
}

export default GenomeSelector
