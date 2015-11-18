var sonne = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

exports.state = permutations(a => (a.indexOf(sonne.comp.state) !== -1), (one, two, three) => {
  return {
    saveLoad: (test) => {
      test.expect(3)
      var state = sonne.make(one, two, three)
      state.of(4)
        .save()
        .map((val) => {
          test.equal(val, 4, '"save" does not affect the wrapped value')
          return 6
        })
        .map((val) => {
          test.equal(val, 6, '"map" replaces the wrapped value')
          return val
        })
        .load()
        .map((val) => {
          test.equal(val, 4, '"load" brings back the saved value')
          return val
        })
        .run()
      test.done()
    },
    run: (test) => {
      var val = 3
      var state = sonne.make(one, two, three)
      test.equal(state.of(val).run(), val, "run brings back the original value")
      debugger
      test.done()
    },
    mapState: (test) => {
      var state = sonne.make(one, two, three)
      var val = state.of(4)
        .mapState((val, state) => {
          return [val, val+1]
        })
        .load()
        .run()
      test.equal(val, 5, '"mapState" lets you consume the value and state and return a new value and a new state.')
      test.done()
    }

  }
})
