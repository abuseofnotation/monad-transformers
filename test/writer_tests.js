
if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
var sonne = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

exports.writer = (test) => {
  var writer = sonne.make(sonne.data.writer)
  test.equal(writer.of(5).log('foo').log('bar')._value[1], 'foobar')

 // test.deepEqual(spy.returnValues, ['foo', 'bar', 'baz'])
  test.done()
}
