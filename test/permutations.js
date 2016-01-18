// This modules allows you to run nodeunit tests on all possible combinations of monads, defined in the library
var combinatorics = require('js-combinatorics')

const id = require('../lib/id')
const data = require('../lib/data')
const comp = require('../lib/comp')

const monads = [].concat([data.writer, data.list, data.maybe, id.idMinimal, id.id, id.idWrapped, comp.state, comp.reader])

const stacks = combinatorics.permutation(monads, 3).toArray()

module.exports = (stackFilter, testFunction) => stacks.filter(stackFilter).reduce((obj, stack) => {
    obj[stack.map(s => s.name).join('')] = testFunction.apply(null, stack)
    return obj
  }, {})
