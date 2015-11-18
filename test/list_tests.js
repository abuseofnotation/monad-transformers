var sonne = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

exports.list = permutations(a => (a.indexOf(sonne.data.list) !== -1), (one, two, three) => {
  return {
    run: () => {
      var list = sonne.make(one, two, three)
      //TODO, fix this
      // list.lift(sonne.comp.list, [1,2,3]).run()
      test.done()
    }
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
