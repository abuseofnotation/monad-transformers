var mtl = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

//TODO add err handling to all types
exports.cont = permutations(a => (a.indexOf(mtl.comp.continuation) !== -1), (one, two, three) => {
  return {
    testOne: (test) => {
      var maybe = mtl.make(one, two, three)
      var spy = sinon.spy((a) => a)
      test.done()
    }
  }
})
