/* ## `comp.state`
 * 
 * The `state` monad transformer allows you to keep one additional state value
 * with your computation.
 *
 * ### Definition
 *
 * ![State](img/state.png)
 *
 * ###Source
 */
exports.state = {
  name: 'State',
  of (val) {
    return (prevState) => this.outer.of([val, prevState])
  },
  chain (funk, state) {
    return (prevState) =>
      this.outer.chain((params) => {
        const newVal = params[0], newState = params[1]
        return funk(newVal)(newState)
      }, state(prevState))
  },
  lift (val) {
    return (prevState) =>
      this.outer.chain((innerValue) => this.outer.of([innerValue, prevState]), val)
  },
  load (val) {
    return (prevState) => this.outer.of([prevState, prevState])
  },
  save (val) {
    return (prevState) => this.outer.of([val, val])
  },
  statefulMap (funk, val) {
    return (prevState) => this.outer.of(funk(val, prevState))
  },
  statefulChain(funk, val) {
    return (prevState) => funk(val, prevState)
  },
  value (funk, state) {
    return this.outer.value((params) => {
      return funk(params[0])
    }, state())
  }
}

/* 
 * [_View in GitHub_](../lib/comp.js)
 */

/* ## `comp.continuation`
 * 
 *
 * ### Definition
 *
 * ![Continuation](img/cont.png)
 *
 * ###Source
 */
exports.continuation = {
  name: 'Continuation',
  of (val) {
    debugger
    return (callback) => callback(val)
  },
  chain (funk, cont) {
    return (callback) => {
        return cont((val) => {
          return (funk(val))(callback)
        })
      }
  },
  lift (val) {
    return (callback) => {
      return this.outer.chain(callback, val)
    }
  },
  value (funk, cont) {
    debugger
    return cont(funk)
    /*
    return cont((val) => {
      debugger
      return this.outer.value(funk, val)
    })
    */

  },
  fromCont (funk) {
    return funk
  }
}

/* 
 * [_View in GitHub_](../lib/comp.js)
 */

/* ## References
 * 
 * All images, taken from [the Wikipedia article on monad transformers](https://en.wikipedia.org/wiki/Monad_transformer).
 */
