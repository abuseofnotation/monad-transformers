var sonne = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

exports.list = permutations(a => (a.indexOf(sonne.data.list) !== -1), (one, two, three) => {
  return {
  }
})

exports.listMaybeGet = (test) => {
  var listMaybe = sonne.make(sonne.comp.list, sonne.data.maybe)
  var spy = sinon.spy((a) => a)
  listMaybe.lift(sonne.comp.list, [{name: 'foo'}, {name: 'bar'}, {name: 'baz'}])
    .get('name')
    .map(spy)

  test.deepEqual(spy.returnValues, ['foo', 'bar', 'baz'])
  test.done()
}
exports.listMaybeFilter = (test) => {
  var listMaybe = sonne.make(sonne.comp.list, sonne.data.maybe)
  var spy = sinon.spy((a) => a)
  listMaybe.lift(sonne.comp.list, [{name: 'foo'}, {name: 'bar'}, {name: 'baz'}])
    .filter(a => a.name === 'foo')
    .map(spy)

  test.deepEqual(spy.returnValues, [{name:'foo'}])
  test.done()
}
