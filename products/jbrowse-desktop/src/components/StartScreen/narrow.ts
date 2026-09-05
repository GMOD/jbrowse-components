/**
 * The width below which the start screen stops being two columns.
 *
 * One string because both halves of the response have to agree: the CSS that
 * stacks the panels, and the `useMediaQuery` that drops the recent-sessions
 * grid's path column. `makeStyles` here is handed JBrowse's own style theme,
 * which carries no breakpoints, so there is nothing to derive it from.
 */
export const NARROW_QUERY = '(max-width: 600px)'

export const narrowMedia = `@media ${NARROW_QUERY}`
