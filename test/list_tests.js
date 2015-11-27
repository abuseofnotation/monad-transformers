if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
var sonne = require('../lib/main')
var sinon = require('sinon')
var permutations = require('./permutations')

const oneList = [1]
const theList = [1,2,3]
exports.list = permutations(a => (a.indexOf(sonne.data.list) !== -1 ), (one, two, three) => {
  return {
    value: (test) => {
      var list = sonne.make(one, two, three)
      test.deepEqual(list.fromArray(oneList).value(), oneList, 'A list of one element is regained with the value method')
      test.done()
    },
    filter: (test) => {
      var list = sonne.make(one, two, three)
      const method = (a) => a === 1
      test.deepEqual(list.fromArray(theList).filter(method).value(), theList.filter(method) , 'The filter method works as the build in')
      test.done()
    },
    map: (test) => {
      var list = sonne.make(one, two, three)
      const method = (a) => a + 1
      test.deepEqual(list.fromArray(theList).map(method).value(), theList.map(method) , 'The map method works as the build in')
      test.done()
    }
  }
})

exports.listMaybeGet = (test) => {
  var listMaybe = sonne.make(sonne.data.list, sonne.data.maybe)
  var spy = sinon.spy((a) => a)
  listMaybe.fromArray([{name: 'foo'}, {name: 'bar'}, {name: 'baz'}])
    .get('name')
    .map(spy)

  test.deepEqual(spy.returnValues, ['foo', 'bar', 'baz'])
  test.done()
}
exports.listMaybeFilter = (test) => {
  var listMaybe = sonne.make(sonne.data.list, sonne.data.maybe)
  var spy = sinon.spy((a) => a)
  listMaybe.fromArray([{name: 'foo'}, {name: 'bar'}, {name: 'baz'}])
    .filter(a => a.name === 'foo')
    .map(spy)

  test.deepEqual(spy.returnValues, [{name:'foo'}])
  test.done()
}
