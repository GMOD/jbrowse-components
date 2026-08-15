import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

/**
 * The hover tooltip both comparative views show for the alignment under the
 * cursor, as LINES.
 *
 * Lines as text nodes, not an HTML string, and that is the point of sharing it.
 * Every line here carries data out of an alignment file — a refName, a feature
 * name — which can hold anything, so this path has nothing to sanitize and no
 * way to inject. The synteny side used to join its lines with `<br/>` and pay
 * for a `SanitizedHTML` to make that safe again; the dotplot side, written
 * later, did not, and the two then disagreed about what a tooltip even was.
 *
 * `clientPoint` is optional because the two views anchor differently: the
 * dotplot puts its tooltip on the pointer (there is one shared canvas and no
 * per-feature element to attach to), while the synteny display lets
 * `BaseTooltip` follow the pointer itself.
 */
const ComparativeTooltip = observer(function ComparativeTooltip({
  lines,
  clientPoint,
  placement,
}: {
  lines: string[]
  clientPoint?: { x: number; y: number }
  placement?: 'left' | 'right'
}) {
  // One text node under `pre-wrap`, rather than a `<br/>` between each line:
  // the lines carry no markup by construction, so the only thing an element per
  // line would buy is a React key list with nothing stable to key on. `pre-wrap`
  // rather than `pre-line` so a refName's own whitespace survives, and either
  // way `BaseTooltip`'s maxWidth still wraps a long one.
  return lines.length ? (
    <BaseTooltip placement={placement} clientPoint={clientPoint}>
      <div style={{ whiteSpace: 'pre-wrap' }}>{lines.join('\n')}</div>
    </BaseTooltip>
  ) : null
})

export default ComparativeTooltip
