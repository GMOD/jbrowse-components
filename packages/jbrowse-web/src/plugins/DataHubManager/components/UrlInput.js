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
  }

  state = {
    networkAvailable: null,
    url: '',
    urlIsValid: null,
    hubTxtIsValid: null,
    errorMessage: '',
    hubTxt: {},
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
      hubTxt: {},
      resolvedUrl: null,
    })
  }

  validateUrl = async () => {
    let { url } = this.state
    if (url.endsWith('/')) url += 'hub.txt'
    const resp = await this.doGet(url)
    const resolvedUrl = new URL(resp.url)
    const hubTxt = await resp.text()
    if (!hubTxt.startsWith('hub ')) {
      this.setState({
        url,
        hubTxtIsValid: false,
        errorMessage:
          'hub.txt file must begin with a line like "hub <hub_name>"',
      })
      return
    }
    const hubTxtFields = [
      'hub',
      'shortLabel',
      'longLabel',
      'genomesFile',
      'email',
      'descriptionUrl',
    ]
    const hubTxtParsed = {}
    try {
      hubTxt.split(/[\r\n]+/).forEach(line => {
        if (line) {
          const sep = line.indexOf(' ')
          if (sep === -1) throw new Error(`Invalid line in hub.txt:\n${line}`)
          const lineKey = line.slice(0, sep)
          if (!hubTxtFields.includes(lineKey))
            throw new Error(`Invalid line in hub.txt:\n${line}`)
          hubTxtParsed[lineKey] = line.slice(sep + 1)
        }
      })
    } catch (e) {
      this.setState({
        url,
        hubTxtIsValid: false,
        errorMessage: e.message || '',
      })
      return
    }
    const missingFields = []
    hubTxtFields.forEach(field => {
      if (field !== 'descriptionUrl' && !hubTxtParsed[field])
        missingFields.push(field)
    })
    if (missingFields.length > 0) {
      this.setState({
        url,
        hubTxtIsValid: false,
        errorMessage: `hub.txt is missing required entr${
          missingFields.length === 1 ? 'y' : 'ies'
        }: ${missingFields.join(', ')}`,
      })
      return
    }
    this.setState({
      url,
      resolvedUrl,
      hubTxt: hubTxtParsed,
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
    const { classes, enableNext } = this.props
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
            error={hubTxtIsValid === false}
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
          />
        ) : null}
      </div>
    )
  }
}

export default withStyles(styles)(TextFields)
