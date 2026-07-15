import { createContext } from 'react'

// A per-track DOM node the TrackContainer mounts *above* its inter-region masks
// (PaddingBlocks: elided/boundary/region-separator blocks). A display's own
// React tree — sealed inside a `contain:strict` sandbox that those masks paint
// over — can `createPortal` floating chrome into this node to escape above the
// masks, without the LGV knowing anything about that chrome. The multi-wiggle
// color legend uses it so the separators don't bury it at whole-genome scale.
//
// null when a display renders outside a TrackContainer (e.g. some tests); a
// consumer must render nothing in that case.
export const TrackOverlayContext = createContext<HTMLElement | null>(null)
