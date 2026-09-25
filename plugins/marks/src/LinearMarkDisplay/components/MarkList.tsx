import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteIcon from '@mui/icons-material/Delete'
import { Button, IconButton, List, ListItemButton } from '@mui/material'

import { addMark, markSummary, moveMark, removeMark } from '../markEdit.ts'
import { worstLevel } from '../markProblemIndex.ts'

import type { DraftMark } from '../markEdit.ts'
import type { MarkProblemIndex } from '../markProblemIndex.ts'

/**
 * The marks in paint order — a later one draws over an earlier one — each a
 * summary of what it reads and a mark of its worst problem. Add appends a mark
 * at its defaults rather than asking for a type first: the type select is the
 * first control in the pane beside this, and the rules say at once what the
 * new mark still needs.
 */
export default function MarkList({
  marks,
  selected,
  problems,
  onSelect,
  onChange,
}: {
  marks: readonly DraftMark[]
  selected: number
  problems: MarkProblemIndex
  onSelect: (index: number) => void
  onChange: (marks: DraftMark[]) => void
}) {
  return (
    <div>
      <List dense disablePadding data-testid="mark-list">
        {marks.map((mark, index) => {
          const worst = worstLevel(problems.forMark(index))
          return (
            <ListItemButton
              // eslint-disable-next-line @eslint-react/no-array-index-key -- a mark has no identity but its place, which is its paint order
              key={index}
              selected={index === selected}
              onClick={() => {
                onSelect(index)
              }}
              data-testid={`mark-row-${index}`}
            >
              <span style={{ flex: 1 }}>{markSummary(mark)}</span>
              {worst ? (
                <span data-testid={`mark-row-${index}-${worst}`}>
                  {worst === 'error' ? '⨯' : '⚠'}
                </span>
              ) : null}
              <IconButton
                aria-label={`move mark ${index + 1} up`}
                disabled={index === 0}
                onClick={event => {
                  event.stopPropagation()
                  onChange(moveMark(marks, index, -1))
                  onSelect(index - 1)
                }}
              >
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label={`move mark ${index + 1} down`}
                disabled={index === marks.length - 1}
                onClick={event => {
                  event.stopPropagation()
                  onChange(moveMark(marks, index, 1))
                  onSelect(index + 1)
                }}
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label={`remove mark ${index + 1}`}
                onClick={event => {
                  event.stopPropagation()
                  onChange(removeMark(marks, index))
                  onSelect(Math.max(0, Math.min(selected, marks.length - 2)))
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </ListItemButton>
          )
        })}
      </List>
      <Button
        onClick={() => {
          onChange(addMark(marks))
          onSelect(marks.length)
        }}
      >
        Add mark
      </Button>
    </div>
  )
}
