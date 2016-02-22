if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}

var mtl = require('../lib/main')
var sinon = require('sinon')

exports.listMaybeGet = (test) => {
  var listMaybe = mtl.make(mtl.data.list, mtl.data.maybe)
  var spy = sinon.spy((a) => a)
  listMaybe.fromArray([{name: 'foo'}, {name: 'bar'}, {name: 'baz'}])
    .maybeGet('name')
    .map(spy)

  test.deepEqual(spy.returnValues, ['foo', 'bar', 'baz'])
  test.done()
}
exports.listMaybeFilter = (test) => {
  var listMaybe = mtl.make(mtl.data.list, mtl.data.maybe)
  var spy = sinon.spy((a) => a)
  listMaybe.fromArray([{name: 'foo'}, {name: 'bar'}, {name: 'baz'}])
    .filter(a => a.name === 'foo')
    .map(spy)

  test.deepEqual(spy.returnValues, [{name:'foo'}])
  test.done()
}
