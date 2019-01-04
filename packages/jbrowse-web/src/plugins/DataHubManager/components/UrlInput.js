import { HubFile } from '@gmod/ucsc-hub'
import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import InputAdornment from '@material-ui/core/InputAdornment'
import { withStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField'
import PropTypes from 'prop-types'
import React from 'react'
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

class TextFields extends React.Component {
  static propTypes = {
    classes: PropTypes.shape({
      textField: PropTypes.string.isRequired,
      validateButton: PropTypes.string.isRequired,
    }).isRequired,
    enableNext: PropTypes.func.isRequired,
    disableNext: PropTypes.func.isRequired,
    setTrackDbUrl: PropTypes.func.isRequired,
    setAssemblyName: PropTypes.func.isRequired,
  }

  state = {
    url: '',
    resolvedUrl: null,
    hubTxt: null,
    errorMessage: null,
    errorHelperMessage: null,
  }

  handleChange = event => {
    const { disableNext } = this.props
    disableNext()
    this.setState({
      url: event.target.value,
      resolvedUrl: null,
      hubTxt: null,
      errorMessage: null,
      errorHelperMessage: null,
    })
  }

  validateUrl = async () => {
    const { setHubName } = this.props
    let { url } = this.state
    if (url.endsWith('/')) url += 'hub.txt'
    let response
    try {
      response = await fetch(url)
    } catch (error) {
      this.setState({
        errorMessage: 'Network error',
        errorHelperMessage: error.message,
      })
      return
    }
    if (!response.ok) {
      this.setState({
        errorMessage: 'Could not access the URL',
        errorHelperMessage: `${response.status}: ${response.statusText}`,
      })
      return
    }
    const resolvedUrl = new URL(response.url)
    const responseText = await response.text()
    let hubTxt
    try {
      hubTxt = new HubFile(responseText)
    } catch (error) {
      this.setState({
        url,
        errorMessage: 'Could not parse hub.txt file',
        errorHelperMessage: error.message,
      })
      return
    }
    setHubName(hubTxt.get('shortLabel'))
    this.setState({
      url,
      resolvedUrl,
      hubTxt,
    })
  }

  render() {
    const { classes, enableNext, setTrackDbUrl, setAssemblyName } = this.props
    const {
      url,
      hubTxt,
      resolvedUrl,
      errorMessage,
      errorHelperMessage,
    } = this.state

    return (
      <div>
        <div>
          <TextField
            autoFocus
            label={<strong>{errorMessage}</strong> || 'Track Hub URL'}
            className={classes.textField}
            value={url}
            onChange={this.handleChange}
            helperText={
              errorMessage
                ? errorHelperMessage
                : 'This is usually a URL that leads to a "hub.txt" file'
            }
            error={Boolean(errorMessage)}
            type="url"
            onKeyUp={event => {
              if (event.keyCode === 13) this.validateUrl()
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
          onClick={this.validateUrl}
          disabled={Boolean(errorMessage)}
          className={classes.validateButton}
        >
          Validate URL
        </Button>
        {resolvedUrl ? (
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
}

export default withStyles(styles)(TextFields)
