import { types, flow } from 'mobx-state-tree'

const AnimatedProperty = types
  .model({
    value: 0,
  })
  .volatile({
    nextValue: 0,
    velocity: 0,

    stiffness: 20, // in Hooke's law, this is "k"
    damping: 20, // called "b" in many online guides

    fps: 30,
  })
  .actions(self => ({
    goTo: flow(function* goTo(newVal) {
      self.nextValue = newVal
    }),
    set(newVal) {
      self.value = newVal
      self.nextValue = newVal
    },
  }))
  .views(self => ({
    get animating() {
      return self.nextValue !== self.value
    },
  }))
