import { useEffect, useRef } from 'react'

import { observer } from 'mobx-react'

import { makeStyles } from '../../util/tss-react/index.ts'
import { useEventCallback } from '../../util/useEventCallback.ts'

const useStyles = makeStyles()(theme => ({
  input: {
    width: '100%',
    height: 21,
    boxSizing: 'border-box',
    padding: '0 4px',
    font: 'inherit',
    color: theme.palette.text.primary,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.accent}`,
    borderRadius: 2,
    outline: 'none',
    verticalAlign: 'middle',
  },
}))

/**
 * A small input that edits a cell's text: Enter, leaving it, or its row
 * scrolling out of view commits, and Escape cancels. An unchanged value, or a
 * blank one unless `allowBlank`, commits nothing.
 */
const CellTextInput = observer(function CellTextInput({
  value,
  label,
  allowBlank,
  onCommit,
  onClose,
}: {
  value: string
  label: string
  allowBlank?: boolean
  onCommit: (text: string) => void
  /** `byKey` when Enter or Escape closed it, so focus can go back */
  onClose: (byKey: boolean) => void
}) {
  const { classes } = useStyles()
  const typed = useRef(value)
  const settled = useRef(false)
  const commit = useEventCallback((text: string) => {
    if (text !== value && (allowBlank || text.trim() !== '')) {
      onCommit(text)
    }
  })

  useEffect(
    () => () => {
      if (!settled.current) {
        commit(typed.current)
      }
    },
    [commit],
  )

  function finish(text: string | undefined, byKey: boolean) {
    if (!settled.current) {
      settled.current = true
      if (text !== undefined) {
        commit(text)
      }
      onClose(byKey)
    }
  }

  return (
    <input
      className={classes.input}
      aria-label={label}
      defaultValue={value}
      autoFocus
      onFocus={event => {
        event.currentTarget.select()
      }}
      onChange={event => {
        typed.current = event.currentTarget.value
      }}
      onClick={event => {
        event.stopPropagation()
      }}
      onDoubleClick={event => {
        event.stopPropagation()
      }}
      onKeyDown={event => {
        if (
          (event.key === 'Enter' || event.key === 'Escape') &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault()
          event.stopPropagation()
          finish(
            event.key === 'Enter' ? event.currentTarget.value : undefined,
            true,
          )
        }
      }}
      onBlur={event => {
        finish(event.currentTarget.value, false)
      }}
    />
  )
})

export default CellTextInput
