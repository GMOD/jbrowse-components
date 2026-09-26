import { makeStyles } from '@jbrowse/core/util/tss-react'

import { worstLevel } from '../markProblemIndex.ts'
import { problemText } from '../markProblems.ts'

import type { MarkProblem } from '../markProblems.ts'

const useStyles = makeStyles()(theme => ({
  error: { color: theme.palette.error.main },
  warning: { color: theme.palette.warning.main },
  list: { margin: 0, paddingLeft: theme.spacing(2) },
}))

/**
 * What is wrong at one control, under it. An error reddens; a warning is a
 * plot the author may not have meant and reads as a remark, since the display
 * draws it either way. The level is always `MARK_RULES`' own.
 */
export function MarkSlotProblems({
  problems,
}: {
  problems: readonly MarkProblem[]
}) {
  const { classes } = useStyles()
  const worst = worstLevel(problems)
  return worst ? (
    <span className={classes[worst]} data-testid={`slot-problems-${worst}`}>
      {problems.map(problem => problem.message).join('; ')}
    </span>
  ) : null
}

/**
 * Every problem a plot has, each naming its mark and its slot: the report
 * under the JSON box, and the one beside a plot too broken for the controls.
 */
export function MarkProblemList({
  problems,
}: {
  problems: readonly MarkProblem[]
}) {
  const { classes } = useStyles()
  return problems.length > 0 ? (
    <ul className={classes.list} data-testid="mark-plot-problems">
      {problems.map(problem => {
        const text = problemText(problem)
        return (
          <li
            key={`${problem.rule} ${text}`}
            className={classes[problem.level]}
          >
            {text}
          </li>
        )
      })}
    </ul>
  ) : null
}
