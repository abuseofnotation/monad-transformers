/* 
 * # Example Part 3 - Side effects
 *
 * _Creating custom monads._
 *
 * The monadic functions that we used so far were really cool and all, but they were just functions, albeit
 * asynchronous. They only received input at the beginning and did not place any output until the end.
 * Technically they were not pure (because they accessed and modified external resources), but they were
 * pretty close.
 * 
 * Now we are going to do something different - a procedure that is in constant connection with the outside
 * world. We are going to handle IO.
 * 
 */
const mtl = require("../lib/main.js")
const m = mtl.advanced

const react = {
  name: 'React',
  of (val) {
    return this.outer.of(val)
  },
  chain (fn, val) {
    return this.outer.chain(fn, val)
  },
  lift (val) {
    return val
  },
  run (value, val) {
    return value(val)
  },
  fold (value, val) {
    return value(val)
  },
  render(val) {
    document.innerHTML = render()
    return this.outer.of(val)
  }
}
