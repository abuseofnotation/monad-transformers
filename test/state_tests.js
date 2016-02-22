if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
var mtl = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

exports.state = permutations(a => (a.indexOf(mtl.comp.state) !== -1), (one, two, three) => {
  return {
    saveLoad: (test) => {
      test.expect(3)
      var state = mtl.make(one, two, three)
      state.of(4)
        .saveState()
        .map((val) => {
          test.equal(val, 4, '"save" does not affect the wrapped value')
          return 6
        })
        .map((val) => {
          test.equal(val, 6, '"map" replaces the wrapped value')
          return val
        })
        .loadState()
        .map((val) => {
          test.equal(val, 4, '"load" brings back the saved value')
          return val
        })
        .value()
      test.done()
    },
    value: (test) => {
      var val = 3
      var state = mtl.make(one, two, three)
      test.equal(state.of(val).value(), val, "value brings back the original value")
      test.done()
    },
    statefulMap: (test) => {
      var state = mtl.make(one, two, three)
      var val = state.of(4)
        .statefulMap((val, state) => {
          return [val, val+1]
        })
        .value({
          onState:(state) => {
            test.equal(state, 5, '"statefulMap" lets you consume the value and state and return a new value and a new state.')
            test.done()
          }
        })
    }

  }
})
global.state = module.exports
