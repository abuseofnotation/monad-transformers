
if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
var sonne = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

exports.writer = (test) => {
  var writer = sonne.make(sonne.data.maybe, sonne.data.writer, sonne.id.id)
  writer.of(5)
    .log('foo')
    .log('bar')
    .mapLog((val) => {
      test.equal(val, 'foobar')
    })

 // test.deepEqual(spy.returnValues, ['foo', 'bar', 'baz'])
  test.done()
}
