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
    networkAvailable: null,
    url: 'hub.txt',
    urlIsValid: null,
    hubTxtIsValid: null,
    errorMessage: '',
    hubTxt: new Map(),
    resolvedUrl: null,
  }

  getLabel() {
    const {
      networkAvailable,
      urlIsValid,
      hubTxtIsValid,
      errorMessage,
    } = this.state
    if (networkAvailable === false) return 'Network error'
    if (urlIsValid === false) return 'Could not access the URL'
    if (hubTxtIsValid === false)
      if (errorMessage) return errorMessage
      else return 'Not a valid hub.txt file'
    return 'Track Hub URL'
  }

  handleChange = event => {
    const { disableNext } = this.props
    disableNext()
    this.setState({
      url: event.target.value,
      networkAvailable: null,
      urlIsValid: null,
      hubTxtIsValid: null,
      errorMessage: '',
      hubTxt: new Map(),
      resolvedUrl: null,
    })
  }

  validateUrl = async () => {
    const { setHubName } = this.props
    let { url } = this.state
    if (url.endsWith('/')) url += 'hub.txt'
    const resp = await this.doGet(url)
    if (!resp) return
    const resolvedUrl = new URL(resp.url)
    const respText = await resp.text()
    let hubTxt
    try {
      hubTxt = new HubFile(respText)
    } catch (error) {
      this.setState({
        url,
        hubTxtIsValid: false,
        errorMessage: `Could not parse hub.txt file:\n${error.message}`,
      })
      return
    }
    setHubName(hubTxt.get('shortLabel'))
    this.setState({
      url,
      resolvedUrl,
      hubTxt,
      hubTxtIsValid: true,
    })
  }

  async doGet(url) {
    let rawResponse
    try {
      rawResponse = await fetch(url)
    } catch {
      this.setState({ networkAvailable: false })
      return null
    }
    if (!rawResponse.ok) {
      this.setState({ urlIsValid: false })
      return null
    }
    return rawResponse
  }

  render() {
    const { classes, enableNext, setTrackDbUrl, setAssemblyName } = this.props
    const { url, hubTxt, hubTxtIsValid, resolvedUrl } = this.state

    return (
      <div>
        <div>
          <TextField
            autoFocus
            label={this.getLabel()}
            className={classes.textField}
            value={url}
            onChange={this.handleChange}
            helperText='This is usually a URL that leads to a "hub.txt" file'
            error={this.getLabel() !== 'Track Hub URL'}
            type="url"
            onKeyUp={event => {
              if (event.keyCode === 13) this.validateUrl()
            }}
            InputProps={
              hubTxtIsValid
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
          disabled={hubTxtIsValid !== null}
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
