interface Animation {
  lastPosition: number
  lastTime?: number
  lastVelocity?: number
}

export interface SpringAnimateOptions {
  from: number
  to: number
  /** applies one frame's value */
  write: (value: number) => void
  /**
   * The live value `write` drives. Supply it when that value is shared with
   * anything else that can move it, and the spring stops as soon as it reads
   * back something other than what it last wrote — an interrupted animation
   * yields instead of overwriting the interruption on its next frame. Omit it for
   * a value only this spring touches.
   */
  read?: () => number
  onFinish?: () => void
  precision?: number
  tension?: number
  friction?: number
  clamp?: boolean
}

// based on https://github.com/react-spring/react-spring/blob/cd5548a987383b8023efd620f3726a981f9e18ea/src/animated/FrameLoop.ts
export function springAnimate({
  from,
  to,
  write,
  read,
  onFinish = () => {},
  precision = 0,
  tension = 400,
  friction = 20,
  clamp = true,
}: SpringAnimateOptions) {
  const mass = 1
  const eps = precision || Math.abs(to - from) / 1000

  let animationFrameId: number
  let lastWritten: number | undefined

  function apply(value: number) {
    write(value)
    lastWritten = read?.()
  }

  // Something other than this spring moved the value, so it owns it now (a wheel
  // zoom, a nav, a drag). Compared against what the spring last WROTE rather
  // than the value it asked for, because `write` may clamp: a spring pushing
  // past a limit would otherwise read its own clamped result back as
  // interference and stop one frame in.
  function interrupted() {
    return (
      read !== undefined && lastWritten !== undefined && read() !== lastWritten
    )
  }

  function update(animation: Animation) {
    // checked before scheduling anything, so an interrupted spring simply stops
    // requesting frames — no cancellation to sequence against the frame this
    // update would have queued
    if (interrupted()) {
      return
    }
    const time = performance.now()
    let position = animation.lastPosition
    let lastTime = animation.lastTime ?? time
    let velocity = animation.lastVelocity ?? 0
    // If we lost a lot of frames just jump to the end.
    if (time > lastTime + 64) {
      lastTime = time
    }
    // https://gafferongames.com/game-physics/fix-your-timestep/
    const numSteps = Math.floor(time - lastTime)
    for (let i = 0; i < numSteps; ++i) {
      const force = -tension * (position - to)
      const damping = -friction * velocity
      const acceleration = (force + damping) / mass
      velocity += (acceleration * 1) / 1000
      position += (velocity * 1) / 1000
    }
    const isVelocity = Math.abs(velocity) <= eps
    const isDisplacement = tension !== 0 ? Math.abs(to - position) <= eps : true
    const isOvershooting =
      clamp && tension !== 0
        ? from < to
          ? position > to
          : position < to
        : false
    const endOfAnimation = isOvershooting || (isVelocity && isDisplacement)
    if (endOfAnimation) {
      apply(to)
      onFinish()
    } else {
      apply(position)
      animationFrameId = requestAnimationFrame(() => {
        update({
          lastPosition: position,
          lastTime: time,
          lastVelocity: velocity,
        })
      })
    }
  }

  return [
    () => {
      update({ lastPosition: from })
    },
    () => {
      cancelAnimationFrame(animationFrameId)
    },
  ] as const
}
