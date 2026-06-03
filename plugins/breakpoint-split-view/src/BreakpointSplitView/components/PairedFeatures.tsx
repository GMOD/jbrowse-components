import { VariantOverlay, buildSimplePath, canonicalPairs } from './overlayUtils.tsx'

import type { OverlayProps, PathSpec } from './overlayUtils.tsx'

export default function PairedFeatures(props: OverlayProps) {
  return (
    <VariantOverlay
      {...props}
      pathTestId="r2"
      render={ctx =>
        [...canonicalPairs(ctx)].map<PathSpec>(({ f1, x1, y1, x2, y2 }) => ({
          id: f1.id(),
          path: buildSimplePath(x1, y1, x2, y2),
        }))
      }
    />
  )
}
