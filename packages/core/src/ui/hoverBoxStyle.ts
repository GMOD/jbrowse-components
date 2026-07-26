import type { CSSProperties } from 'react'

/**
 * The hover mark for a cell or block on a canvas display: a white wash plus a
 * dark border, never a color tint — the cell colors are the data, and a tint
 * washes them out.
 *
 * One definition because the alternative was proven to fail: `highlightBoxColors`
 * exists for the same reason, after two backends drifted apart on their own alpha
 * literals kept in step by a comment.
 */
export const hoverBoxStyle: CSSProperties = {
  border: '1px solid rgba(0,0,0,0.5)',
  background: 'rgba(255,255,255,0.3)',
}
