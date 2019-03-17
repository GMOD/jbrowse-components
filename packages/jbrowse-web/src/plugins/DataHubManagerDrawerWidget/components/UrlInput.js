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
  const [url, setUrl] = useState('')
  const [resolvedUrl, setResolvedUrl] = useState(null)
  const [hubTxt, setHubTxt] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [errorHelperMessage, setErrorHelperMessage] = useState(null)

  const {
    classes,
    enableNext,
    disableNext,
    setTrackDbUrl,
    setAssemblyName,
    setHubName,
  } = props

  function handleChange(event) {
    disableNext()
    setUrl(event.target.value)
    setResolvedUrl(null)
    setHubTxt(null)
    setErrorMessage(null)
    setErrorHelperMessage(null)
  }

  async function validateUrl() {
    let newUrl = url
    if (newUrl.endsWith('/')) newUrl += 'hub.txt'
    let response
    try {
      response = await fetch(newUrl)
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
    const newResolvedUrl = new URL(response.url)
    const responseText = await response.text()
    let newHubTxt
    try {
      newHubTxt = new HubFile(responseText)
    } catch (error) {
      setUrl(newUrl)
      setErrorMessage('Could not parse hub.txt file')
      setErrorHelperMessage(error.message)
      return
    }
    setHubName(newHubTxt.get('shortLabel'))
    setUrl(newUrl)
    setResolvedUrl(newResolvedUrl)
    setHubTxt(newHubTxt)
  }

  return (
    <div>
      <div>
        <TextField
          autoFocus
          label={<strong>{errorMessage}</strong> || 'Track Hub URL'}
          className={classes.textField}
          value={url}
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
            resolvedUrl
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
          hubTxtUrl={resolvedUrl}
          hubTxt={hubTxt}
          enableNext={enableNext}
          setTrackDbUrl={setTrackDbUrl}
          setAssemblyName={setAssemblyName}
        />
      ) : null}
    </div>
  )
}

UrlInput.propTypes = {
  classes: PropTypes.shape({
    textField: PropTypes.string.isRequired,
    validateButton: PropTypes.string.isRequired,
  }).isRequired,
  enableNext: PropTypes.func.isRequired,
  disableNext: PropTypes.func.isRequired,
  setTrackDbUrl: PropTypes.func.isRequired,
  setHubName: PropTypes.func.isRequired,
  setAssemblyName: PropTypes.func.isRequired,
}

export default withStyles(styles)(UrlInput)
