import { GenomesFile } from '@gmod/ucsc-hub'
import Card from '@material-ui/core/Card'
import CardActions from '@material-ui/core/CardActions'
import CardContent from '@material-ui/core/CardContent'
import CardHeader from '@material-ui/core/CardHeader'
import Checkbox from '@material-ui/core/Checkbox'
import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormHelperText from '@material-ui/core/FormHelperText'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import FormLabel from '@material-ui/core/FormLabel'
import LinearProgress from '@material-ui/core/LinearProgress'
import Typography from '@material-ui/core/Typography'
import PropTypes from 'prop-types'
import React, { useState, useEffect } from 'react'

function GenomeSelector(props) {
  const [errorMessage, setErrorMessage] = useState(null)
  const [genomesFile, setGenomesFile] = useState(null)

  const { hubTxt, hubUrl, assemblyNames, setAssemblyNames } = props

  useEffect(() => {
    async function getGenomesFile() {
      const genomesFileUrl = new URL(hubTxt.get('genomesFile'), new URL(hubUrl))
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

    getGenomesFile()
  }, [genomesFile, hubTxt, hubUrl])

  function handleChange(event) {
    const assemblyName = event.target.value
    if (assemblyNames.includes(assemblyName))
      setAssemblyNames(
        assemblyNames.filter(assembly => assembly !== assemblyName),
      )
    else setAssemblyNames(assemblyNames.concat([assemblyName]))
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
            <FormLabel>Assemblies</FormLabel>
            {Array.from(genomesFile.values()).map(genome => {
              const genomeName = genome.get('genome')
              return (
                <FormControlLabel
                  key={genomeName}
                  control={
                    <Checkbox
                      checked={assemblyNames.includes(genomeName)}
                      onChange={handleChange}
                      value={genomeName}
                    />
                  }
                  label={genomeName}
                />
              )
            })}
            <FormHelperText>
              Select the assemblies you would like to add
            </FormHelperText>
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
              href={new URL(hubTxt.get('descriptionUrl'), new URL(hubUrl)).href}
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
  hubUrl: PropTypes.string.isRequired,
  hubTxt: PropTypes.instanceOf(Map).isRequired,
  assemblyNames: PropTypes.arrayOf(PropTypes.string).isRequired,
  setAssemblyNames: PropTypes.func.isRequired,
}

export default GenomeSelector
