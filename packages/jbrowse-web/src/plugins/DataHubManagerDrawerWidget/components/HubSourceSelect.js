import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormHelperText from '@material-ui/core/FormHelperText'
import Link from '@material-ui/core/Link'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import propTypes from 'prop-types'
import React from 'react'

const hubSourceDescriptions = {
  trackHubRegistry: (
    <FormHelperText>
      Search{' '}
      <Link
        href="https://trackhubregistry.org/"
        rel="noopener noreferrer"
        target="_blank"
      >
        The Track Hub Registry
      </Link>
    </FormHelperText>
  ),
  ucscCustom: <FormHelperText>User-provided track hub URL</FormHelperText>,
  jbrowseRegistry: (
    <FormHelperText>As-yet-unimplemented JBrowse data registry</FormHelperText>
  ),
  jbrowseCustom: (
    <FormHelperText>User-provided JBrowse 1 data directory URL</FormHelperText>
  ),
}

function HubSourceSelect(props) {
  const { hubSource, setHubSource, hubType } = props
  let hubSources = []
  if (hubType === 'ucsc')
    hubSources = [
      { value: 'trackHubRegistry', label: 'The Track Hub Registry' },
      { value: 'ucscCustom', label: 'Track Hub URL' },
    ]
  return (
    <FormControl component="fieldset">
      <RadioGroup value={hubSource} onChange={setHubSource}>
        {hubSources.map(entry => (
          <FormControlLabel
            key={entry.value}
            control={<Radio />}
            value={entry.value}
            label={entry.label}
            data-testid={entry.value}
          />
        ))}
      </RadioGroup>
      {hubSourceDescriptions[hubSource]}
    </FormControl>
  )
}

HubSourceSelect.defaultProps = {
  hubSource: undefined,
  hubType: undefined,
}

HubSourceSelect.propTypes = {
  hubSource: propTypes.string,
  hubType: propTypes.string,
  setHubSource: propTypes.func.isRequired,
}

export default HubSourceSelect
