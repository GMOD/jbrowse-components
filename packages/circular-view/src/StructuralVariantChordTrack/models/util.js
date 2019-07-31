export default ({ jbrequire }) => {
  const { reaction } = jbrequire('mobx')

  const { addDisposer, isAlive } = jbrequire('mobx-state-tree')
  const { isAbortException } = jbrequire('@gmod/jbrowse-core/util')

  /**
   * makes a mobx reaction with the given functions, that calls actions
   * on the model for each stage of execution, and to abort the reaction function when the
   * model is destroyed.
   *
   * Will call flowNameStarted(signal), lowNameSuccess(result), and
   * flowNameError(error) actions on the given state tree model when the
   * async reaction function starts, completes, and errors respectively.
   *
   * @param {StateTreeNode} self
   * @param {string} flowName
   * @param {function} dataFunction -> data
   * @param {async_function} asyncReactionFunction(data, signal) -> result
   * @param {object} reactionOptions
   */
  function makeAbortableReaction(
    self,
    flowName,
    dataFunction,
    asyncReactionFunction,
    reactionOptions,
  ) {
    let inProgress
    const reactionDisposer = reaction(
      dataFunction,
      data => {
        if (inProgress && !inProgress.signal.aborted) inProgress.abort()
        if (!isAlive(self)) return
        inProgress = new AbortController()
        self[`${flowName}Started`](inProgress)
        Promise.resolve()
          .then(() => asyncReactionFunction(data, inProgress.signal))
          .then(result => {
            if (isAlive(self)) self[`${flowName}Success`](result)
          })
          .catch(error => {
            if (inProgress && !inProgress.signal.aborted) inProgress.abort()
            if (!isAbortException(error)) {
              if (isAlive(self)) self[`${flowName}Error`](error)
              else console.error(error)
            }
          })
      },
      reactionOptions,
    )
    addDisposer(self, reactionDisposer)
    addDisposer(self, () => {
      if (inProgress && !inProgress.signal.aborted) inProgress.abort()
    })
  }

  return { makeAbortableReaction }
}
