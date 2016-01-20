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
  value (f, state) {
    return this.outer.value((params) => {
      return f(params[0])
    }, state())
  },
  run (f, state) {
    return f(state())
  },
  fold (value, params) {
    (this.onState || idFunc)(params[1])
    return value(params[0])
  },
  //Custom functions:
  load (val) {
    return (prevState) => this.outer.of([prevState, prevState])
  },
  save (val) {
    return (prevState) => this.outer.of([val, val])
  },
  statefulMap (funk, val) {
    return (prevState) => this.outer.of(funk(val, prevState))
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
    debugger
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
  envMap (f, val) {
    return (environment) => this.outer.of(f(val, environment))
  }
}
/* 
 * [_View in GitHub_](../lib/comp.js)
 */

/* ## References
 * 
 * All images, taken from [the Wikipedia article on monad transformers](https://en.wikipedia.org/wiki/Monad_transformer).
 */
