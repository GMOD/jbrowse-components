import { HubFile } from '@gmod/ucsc-hub'
import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import InputAdornment from '@material-ui/core/InputAdornment'
import { withStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField'
import PropTypes from 'prop-types'
import React, { useState } from 'react'
import GenomeSelector from './GenomeSelector'

const styles = theme => ({
  textField: {
    marginLeft: theme.spacing.unit * 2,
    marginRight: theme.spacing.unit * 2,
    minWidth: 192,
  },
  validateButton: {
    marginLeft: theme.spacing.unit * 4,
    marginRight: theme.spacing.unit * 4,
    marginTop: theme.spacing.unit,
    marginBottom: theme.spacing.unit,
  },
})

function UrlInput(props) {
  const [hubTxt, setHubTxt] = useState(null)
  const [validated, setValidated] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [errorHelperMessage, setErrorHelperMessage] = useState(null)

  const {
    classes,
    assemblyNames,
    setAssemblyNames,
    setHubName,
    hubUrl,
    setHubUrl,
  } = props

  function handleChange(event) {
    setValidated(false)
    setHubUrl(event.target.value)
    setHubTxt(null)
    setErrorMessage(null)
    setErrorHelperMessage(null)
  }

  async function validateUrl() {
    setValidated(true)
    let response
    try {
      response = await fetch(hubUrl.endsWith('/') ? `${hubUrl}hub.txt` : hubUrl)
    } catch (error) {
      setErrorMessage('Network error')
      setErrorHelperMessage(error.message)
      return
    }
    if (!response.ok) {
      setErrorMessage('Could not access the URL')
      setErrorHelperMessage(`${response.status}: ${response.statusText}`)
      return
    }
    const resolvedUrl = response.url
    const responseText = await response.text()
    let newHubTxt
    try {
      newHubTxt = new HubFile(responseText)
    } catch (error) {
      setHubUrl(resolvedUrl)
      setErrorMessage('Could not parse hub.txt file')
      setErrorHelperMessage(error.message)
      return
    }
    setHubName(newHubTxt.get('shortLabel'))
    setHubUrl(resolvedUrl)
    setHubTxt(newHubTxt)
  }

  return (
    <div>
      <div>
        <TextField
          autoFocus
          label={<strong>{errorMessage}</strong> || 'Track Hub URL'}
          className={classes.textField}
          value={hubUrl}
          onChange={handleChange}
          helperText={
            errorMessage
              ? errorHelperMessage
              : 'This is usually a URL that leads to a "hub.txt" file'
          }
          error={Boolean(errorMessage)}
          type="url"
          onKeyUp={event => {
            if (event.keyCode === 13) validateUrl()
          }}
          InputProps={
            validated && !errorMessage
              ? {
                  endAdornment: (
                    <InputAdornment disableTypography position="end">
                      <Icon style={{ color: 'green' }}>check_circle</Icon>
                    </InputAdornment>
                  ),
                }
              : {}
          }
        />
      </div>
      <Button
        variant="contained"
        onClick={validateUrl}
        disabled={Boolean(errorMessage)}
        className={classes.validateButton}
      >
        Validate URL
      </Button>
      {hubTxt ? (
        <GenomeSelector
          hubUrl={hubUrl}
          hubTxt={hubTxt}
          assemblyNames={assemblyNames}
          setAssemblyNames={setAssemblyNames}
        />
      ) : null}
    </div>
  )
}

UrlInput.propTypes = {
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
  setHubName: PropTypes.func.isRequired,
  hubUrl: PropTypes.string.isRequired,
  setHubUrl: PropTypes.func.isRequired,
  assemblyNames: PropTypes.arrayOf(PropTypes.string).isRequired,
  setAssemblyNames: PropTypes.func.isRequired,
}

export default withStyles(styles)(UrlInput)
