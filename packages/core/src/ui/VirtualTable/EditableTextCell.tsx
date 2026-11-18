import { useRef, useState } from 'react'

import EditIcon from '@mui/icons-material/Edit'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../../util/tss-react/index.ts'
import CellTextInput from './CellTextInput.tsx'

const useStyles = makeStyles()({
  cell: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  },
  text: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  clickable: {
    cursor: 'text',
  },
  pencil: {
    padding: 2,
    flexShrink: 0,
  },
  pencilIcon: {
    fontSize: 16,
  },
})

/**
 * A table cell's text with a pencil that edits it in place through a
 * `CellTextInput`; focus goes back to the pencil when a key closes the input.
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
  /** names the pencil and the input, such as "Rename chr1:1..100" */
  label: string
  onCommit: (text: string) => void
  allowBlank?: boolean
  /** a click on the text opens the input too */
  editOnClick?: boolean
  /** what the cell shows while not editing, the value when unset */
  children?: React.ReactNode
}) {
  const { classes, cx } = useStyles()
  const [editing, setEditing] = useState(false)
  const refocus = useRef(false)

  function start() {
    setEditing(true)
  }

  return editing ? (
    <CellTextInput
      value={value}
      label={label}
      allowBlank={allowBlank}
      onCommit={onCommit}
      onClose={byKey => {
        refocus.current = byKey
        setEditing(false)
      }}
    />
  ) : (
    <div className={classes.cell}>
      <span
        className={cx(classes.text, editOnClick && classes.clickable)}
        onClick={editOnClick ? start : undefined}
      >
        {children ?? value}
      </span>
      <IconButton
        ref={el => {
          if (el && refocus.current) {
            refocus.current = false
            el.focus()
          }
        }}
        className={classes.pencil}
        size="small"
        aria-label={label}
        onClick={event => {
          event.stopPropagation()
          start()
        }}
      >
        <EditIcon className={classes.pencilIcon} />
      </IconButton>
    </div>
  )
})

export default EditableTextCell
