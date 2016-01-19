if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
var mtl = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

exports.reader = permutations(a => (a.indexOf(mtl.comp.reader) !== -1), (one, two, three) => {
  return {
    environment: (test) => {
      const reader = mtl.make(one, two, three)
      reader.of(5)
        .readerMap((val, env) => env)
        .map((val) => {
          test.equal(val, 6)
          return val
        })
        .value(a=>{
          test.done()
        }, {environment:6})
    }
  }
})
