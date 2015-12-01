
if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
var sonne = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

exports.writer = permutations(a => (a.indexOf(sonne.data.writer) !== -1), (one, two, three) => {
  return {
    tellListen: (test) => {
      const writer = sonne.make(one, two, three)
      writer.of(5)
        .tell('foo')
        .tell('bar')
        .listen((val) =>{test.equal(val, 'foobar')})
        .value()
      test.done()
    }
  }
})
