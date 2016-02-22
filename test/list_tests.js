if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
var mtl = require('../lib/main')
var permutations = require('./permutations')

const oneList = [1]
const theList = [1,2,3]
exports.list = permutations(a => (a.indexOf(mtl.data.list) !== -1 ), (one, two, three) => {
  return {
    value: (test) => {
      var list = mtl.make(one, two, three)
      test.deepEqual(list.fromArray(oneList).value(), oneList, 'A list of one element is regained with the value method')
      debugger
      test.done()
    },
    filter: (test) => {
      var list = mtl.make(one, two, three)
      const method = (a) => a === 1
      test.deepEqual(list.fromArray(theList).filter(method).value(), theList.filter(method) , 'The filter method works as the build in')
      test.done()
    },
    map: (test) => {
      var list = mtl.make(one, two, three)
      const method = (a) => a + 1
      test.deepEqual(list.fromArray(theList).map(method).value(), theList.map(method) , 'The map method works as the build in')
      test.done()
    }
  }
})

