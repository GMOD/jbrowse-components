import React, { useRef, useState } from 'react'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import SearchIcon from '@material-ui/icons/Search'
import TextField from '@material-ui/core/TextField'
import { useTheme } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import { LinearGenomeViewModel } from '..'

const WIDGET_HEIGHT = 32
const SPACING = 7

export default observer(({ model }: { model: LinearGenomeViewModel }) => {
  const [value, setValue] = useState<string | undefined>()
  const inputRef = useRef<HTMLInputElement>(null)
  const theme = useTheme()
  const { coarseVisibleLocStrings: visibleLocStrings } = model
  const session = getSession(model)

  function navTo(locString: string) {
    try {
      model.navToLocString(locString)
    } catch (e) {
      console.warn(e)
      session.notify(`${e}`, 'warning')
    }
  }

  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        inputRef && inputRef.current && inputRef.current.blur()
        value && navTo(value)
      }}
    >
      <TextField
        inputRef={inputRef}
        onFocus={() => setValue(visibleLocStrings)}
        onBlur={() => setValue(undefined)}
        onChange={event => setValue(event.target.value)}
        variant="outlined"
        value={value === undefined ? visibleLocStrings : value}
        style={{ margin: SPACING, marginLeft: SPACING * 3 }}
        InputProps={{
          'data-testid': 'search-input',
          startAdornment: <SearchIcon />,
          style: {
            background: fade(theme.palette.background.paper, 0.8),
            height: WIDGET_HEIGHT,
          },
        }}
      />
    </form>
  )
})
