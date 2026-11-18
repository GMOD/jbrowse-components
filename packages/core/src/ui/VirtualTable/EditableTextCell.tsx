import { useRef, useState } from 'react'

import { observer } from 'mobx-react'

import { makeStyles } from '../../util/tss-react/index.ts'

const useStyles = makeStyles()(theme => ({
  text: {
    display: 'block',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'text',
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.accent}`,
      outlineOffset: -2,
    },
  },
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
 * A table cell's text that edits in place: a double click, or Enter or F2
 * while it has focus, opens a small input; Enter or leaving it commits and
 * Escape cancels. An unchanged value, or a blank one unless `allowBlank`,
 * commits nothing.
 */
const EditableTextCell = observer(function EditableTextCell({
  value,
  label,
  onCommit,
  allowBlank,
  editOnClick,
  children,
}: {
  value: string
  /** names the text and its input, such as "Rename chr1:1..100" */
  label: string
  onCommit: (text: string) => void
  allowBlank?: boolean
  /** a single click opens the input too */
  editOnClick?: boolean
  /** what the cell shows while not editing, the value when unset */
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const [editing, setEditing] = useState(false)
  const settled = useRef(false)

  function start() {
    settled.current = false
    setEditing(true)
  }
  function finish(text?: string) {
    if (!settled.current) {
      settled.current = true
      setEditing(false)
      if (
        text !== undefined &&
        text !== value &&
        (allowBlank || text.trim() !== '')
      ) {
        onCommit(text)
      }
    }
  }

  return editing ? (
    <input
      className={classes.input}
      aria-label={label}
      defaultValue={value}
      autoFocus
      onFocus={event => {
        event.currentTarget.select()
      }}
      onClick={event => {
        event.stopPropagation()
      }}
      onDoubleClick={event => {
        event.stopPropagation()
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          finish(event.key === 'Enter' ? event.currentTarget.value : undefined)
        }
      }}
      onBlur={event => {
        finish(event.currentTarget.value)
      }}
    />
  ) : (
    <span
      className={classes.text}
      role="button"
      tabIndex={0}
      aria-label={label}
      title={value}
      onClick={editOnClick ? start : undefined}
      onDoubleClick={start}
      onKeyDown={event => {
        if (
          event.target === event.currentTarget &&
          (event.key === 'Enter' || event.key === 'F2')
        ) {
          event.preventDefault()
          start()
        }
      }}
    >
      {children ?? value}
    </span>
  )
})

export default EditableTextCell
