// Width of an inline menu row (a slider row, a stepper) in px.
//
// Its own module, and not a const in `InlineMenuControls.tsx`, because that file
// imports MUI: a caller that wants only the number — to size a placeholder while
// the real row loads, say — would otherwise pull `IconButton`, `Tooltip` and an
// icon in with it. Same reason `ui/menuItems.ts` exists; see
// reference/EAGER_BUNDLE.md.
export const INLINE_MENU_ROW_WIDTH = 220
