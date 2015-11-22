// This modules allows you to run nodeunit tests on all possible combinations of monads, defined in the library
import * as combinatorics from 'js-combinatorics';
import * as id from '../lib-ts/id';
import * as comp from '../lib-ts/comp';
import * as data from '../lib-ts/data';

const monads = [].concat([comp.list, data.maybe, id.id, id.idWrapped, comp.state])

const stacks = combinatorics.permutation(monads, 3).toArray()

export const permutations (stackFilter, testFunction) => stacks.filter(stackFilter).reduce((obj, stack) => {
    obj[stack.map(s => s.name).join('')] = testFunction.apply(null, stack)
    return obj
  }, {})
