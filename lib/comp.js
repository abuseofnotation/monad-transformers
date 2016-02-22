/* ## `comp.state`
 * 
 * The `state` monad transformer allows you to keep one additional mutable state value
 * with your computation.
 *
 * ### `value.save()`
 *
 * Saves the return value of the function in the state, overwriting the previous one.
 *
 * ### `value.load()`
 *
 * Returns the current state.
 *
 * ### `value.statefulMap(f)`
 *
 * Maps over the current value and state with `f`.
 * The function should return an array containing two elements - the new value and the new state.
 *
 * ### Definition
 *
 * ![State](img/state.png)
 *
 * ###Source
 */
const idFunc = a=>a

exports.state = {
  name: 'State',
  //Standard functions:
  of (val) {
    return (prevState) => this.outer.of({value: val, state: prevState})
  },
  chain (funk, state) {
    return (prevState) =>
      this.outer.chain((params) => {
        const newVal = params.value, newState = params.state
        return funk(newVal)(newState)
      }, state(prevState))
  },
  lift (val) {
    return (prevState) =>
      this.outer.chain((innerValue) => this.outer.of({value: innerValue, state: prevState}), val)
  },
  run (f, state) {
    return f(state())
  },
  fold (value, params) {
    (this.onState || idFunc)(params.state)
    return value(params.value)
  },
  //Custom functions:
  loadState (val) {
    return (prevState) => this.outer.of({value: prevState, state: prevState})
  },
  saveState (val) {
    return (prevState) => this.outer.of({value:val, state: val})
  },
  statefulMap (funk, val) {
    return (prevState) => {
      const stateTuple = funk(val, prevState)
      return this.outer.of({value: stateTuple[0], state: stateTuple[1]})
    }
  },
  setState (newState, val) {
    return (prevState) => this.outer.of({value:val, state: newState})
  },
  mapState (funk, val) {
    return (prevState) => this.outer.of({value:val, state: funk(prevState, val)})
  }
}

/* ## `comp.reader`
 * 
 * The `reader` monad transformer allows you to specify an immutable configuration for your function
 * which you can use to tweek the way it behaves.
 *
 * ### Definition
 *
 * ![State](img/writer.png)
 *
 * ###Source
 */
exports.reader = {
  name: 'Reader',
  //Standard functions:
  of (val) {
    return (env) => this.outer.of(val)
  },
  chain (funk, reader) {
    return (env) =>
      this.outer.chain((val) => {
        return funk(val)(env)
      }, reader(env))
  },
  lift (val) {
    return (env) => val
  },
  run (f, reader) {
    return f(reader(this.environment))
  },
  fold (value, val) {
    return value(val)
  },
  //Custom functions:
  readerMap (f, val) {
    return (environment) => this.outer.of(f(val, environment))
  },
  loadEnvironment(val) {
    return (environment) => this.outer.of(environment)
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
  run (f, cont) {
    return cont(f)
  },
  fold (value, val) {
    return value(val)
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
