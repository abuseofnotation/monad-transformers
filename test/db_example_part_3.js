/* 
 * # Example Part 3 - Rendering data on screen
 *
 * _Creating custom monads._
 *
 * The following examples show performing async database operations using the mtl library.
 *
 * We will be mocking a simple simple REST API with a set of resources defined in the `data`
 * object and a function that simulates retriving a resource asynchronously - `getResource`. 
 * 
 * Our task will be related to retrieving info about the users and their occupations and handling different kinds
 * of errors.
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
