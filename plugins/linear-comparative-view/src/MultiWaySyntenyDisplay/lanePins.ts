import { isPieceLane, pieceContig } from './copyLane.ts'

/** the reader's pick of where a lane draws: a contig, and on it a block */
export interface LanePlacePin {
  lane: string
  refName: string
  /** a lane bp in the block picked; none lets the lane choose on the contig */
  at?: number
}

/**
 * the reader's pick of which way a lane faces on `refName`. `flipped` is
 * against `anchor`'s order, as `LaneDecision.flipped` is; a pin naming no
 * anchor holds under any
 */
interface LaneFlipPin {
  lane: string
  refName: string
  flipped: boolean
  anchor?: string
}

export type LanePin = LanePlacePin | LaneFlipPin

type KeyOf = (name: string) => string

export function isFlipPin(pin: LanePin): pin is LaneFlipPin {
  return 'flipped' in pin
}

/** Whether `pin` is the one `lane` holds of its kind under `anchor`. */
function pinHolds(pin: LanePin, lane: string, anchor: string, keyOf: KeyOf) {
  return (
    keyOf(pin.lane) === keyOf(lane) &&
    (!isFlipPin(pin) ||
      pin.anchor === undefined ||
      keyOf(pin.anchor) === keyOf(anchor))
  )
}

/**
 * The row `pin` belongs to: the one spelled as the pin is, else one the pin
 * names by another spelling, since two spellings of an assembly can both be
 * rows, else, for a piece no row holds, named by another fetch, the first
 * row on its contig.
 */
export function pinnedRowOf(
  pin: LanePin,
  lanes: readonly string[],
  anchor: string,
  keyOf: KeyOf,
) {
  const holds = (name: string) => pinHolds(pin, name, anchor, keyOf)
  const contig = pieceContig(pin.lane)
  return (
    lanes.find(name => name === pin.lane && holds(name)) ??
    lanes.find(holds) ??
    (contig === undefined
      ? undefined
      : lanes.find(
          name =>
            pieceContig(name) === contig &&
            pinHolds({ ...pin, lane: name }, name, anchor, keyOf),
        ))
  )
}

/** The pins that hold under `anchor`, each naming its lane as `lanes` spell it. */
export function pinsInForceOf(
  pins: readonly LanePin[],
  lanes: readonly string[],
  anchor: string,
  keyOf: KeyOf,
): LanePin[] {
  return pins.flatMap(pin => {
    const lane = pinnedRowOf(pin, lanes, anchor, keyOf)
    return lane === undefined ? [] : [{ ...pin, lane }]
  })
}

export function placePinOf(pins: readonly LanePin[], lane: string) {
  return isPieceLane(lane)
    ? undefined
    : pins.find(
        (pin): pin is LanePlacePin => !isFlipPin(pin) && pin.lane === lane,
      )
}

export function flipPinOf(pins: readonly LanePin[], lane: string) {
  return pins.find(
    (pin): pin is LaneFlipPin => isFlipPin(pin) && pin.lane === lane,
  )
}

/** `pins` less those `replaced` picks, plus `pin`; empty is undefined */
export function withPin(
  pins: readonly LanePin[],
  replaced: (pin: LanePin) => boolean,
  pin: LanePin | undefined,
) {
  const next = [...pins.filter(p => !replaced(p)), ...(pin ? [pin] : [])]
  return next.length > 0 ? next : undefined
}
