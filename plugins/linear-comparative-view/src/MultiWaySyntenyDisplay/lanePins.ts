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
export interface LaneFlipPin {
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
export function pinHolds(
  pin: LanePin,
  lane: string,
  anchor: string,
  keyOf: KeyOf,
) {
  return (
    keyOf(pin.lane) === keyOf(lane) &&
    (!isFlipPin(pin) ||
      pin.anchor === undefined ||
      keyOf(pin.anchor) === keyOf(anchor))
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
    const lane = lanes.find(name => pinHolds(pin, name, anchor, keyOf))
    return lane === undefined ? [] : [{ ...pin, lane }]
  })
}

export function placePinOf(pins: readonly LanePin[], lane: string) {
  return pins.find(
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
  pins: readonly LanePin[] | undefined,
  replaced: (pin: LanePin) => boolean,
  pin: LanePin | undefined,
) {
  const next = [
    ...(pins ?? []).filter(p => !replaced(p)),
    ...(pin ? [pin] : []),
  ]
  return next.length > 0 ? next : undefined
}
