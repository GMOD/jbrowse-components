interface Animation {
  lastPosition: number
  lastTime?: number
  lastVelocity?: number
}

// based on https://github.com/react-spring/react-spring/blob/cd5548a987383b8023efd620f3726a981f9e18ea/src/animated/FrameLoop.ts
export function springAnimate(
  fromValue: number,
  toValue: number,
  setValue: (value: number) => void,
  onFinish = () => {},
  precision = 0,
  tension = 400,
  friction = 20,
  clamp = true,
) {
  if (!precision) {
    precision = Math.abs(toValue - fromValue) / 1000
  }

  let animationFrameId: number

  function update(animation: Animation) {
    const time = performance.now()
    let position = animation.lastPosition
    let lastTime = animation.lastTime || time
    let velocity = animation.lastVelocity || 0
    // If we lost a lot of frames just jump to the end.
    if (time > lastTime + 64) {
      lastTime = time
    }
    // http://gafferongames.com/game-physics/fix-your-timestep/
    const numSteps = Math.floor(time - lastTime)
    for (let i = 0; i < numSteps; ++i) {
      const force = -tension * (position - toValue)
      const damping = -friction * velocity
      const acceleration = force + damping
      velocity += acceleration / 1000
      position += velocity / 1000
    }
    const isVelocity = Math.abs(velocity) <= precision
    const isDisplacement =
      tension !== 0 ? Math.abs(toValue - position) <= precision : true
    const isOvershooting =
      clamp && tension !== 0
        ? fromValue < toValue
          ? position > toValue
          : position < toValue
        : false
    const endOfAnimation = isOvershooting || (isVelocity && isDisplacement)
    if (endOfAnimation) {
      setValue(toValue)
      onFinish()
    } else {
      setValue(position)
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
      update({ lastPosition: fromValue })
    },
    () => {
      cancelAnimationFrame(animationFrameId)
    },
  ]
}
