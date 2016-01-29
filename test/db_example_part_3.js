
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
