var createStack = require('../lib/stack')
var comp = require('../lib/comp')
var permutations = require('./permutations')

exports.all = permutations( a=>(a.indexOf(comp.state) === -1), (one, two, three) =>
  (test) => {
    const stack = createStack([one, two, three])
    const oneVal = stack.of(one, 5)
    const onetwoVal = stack.of(two, 5)
    const onetwothreeVal = stack.of(three, 5)
    test.deepEqual(stack.lift(one, oneVal), onetwothreeVal, "Lift works for the outer value of stacks of three items.")
    test.deepEqual(stack.lift(two, onetwoVal), onetwothreeVal, "Lift works for the middle value of stacks of three items.")


    // lift . return = return
    // test.deepEqual( stack.lift(one,stack.of(one,5)), stack.of(one,5), "First law")
    test.done()
  })
