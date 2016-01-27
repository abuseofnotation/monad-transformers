const base = require('./base')
const assign = require('object-assign')
const helpers = require('./helpers')

module.exports = function createStack (monadStack) {
  // Generate errors
  const error = new Error('The first argument must be a stack member')

  // Add the ID monad at the bottom of the monad stack
  const stack = [base.id].concat(monadStack)

  //Verify input
  stack.forEach(member => {
    if (typeof member !== 'object') {throw new Error('Stack members must be objects')}
  })

  // Perform some preprocessing on the stack
  const stackProcessed = processStack(stack)

  // Define the lift operation which takes a value of a given level of the stack and lifts it to the last level
  const lift = (val, level) => {
    // Get the stack prototypes for the next level
    const nextLevel = level + 1
    const nextMember = stackProcessed[level + 1]
    // Do not do anything if the value is already at the last level.
    if (nextMember !== undefined) {
      // Perform the lift operation at the necessary level
      // Call the function recursively to get to the next one
      return lift(nextMember.lift(val), nextLevel)
    } else {
      return val
    }
  }
  //Return lift relevant datastructures
  return {
    //lift: lift,
    last: stackProcessed [stackProcessed.length - 1],
    id: base.id,
    members: stackProcessed,
    membersOriginal: stack
  }
}

// Applies the processing function on each stack member,
// passing the previous (outer) member as an argument
const processStack = (baseStack) =>
  statefulMap(baseStack, (item, state) => {
    const itemProcessed = processProtoNew(item, state)
    return [ itemProcessed,itemProcessed]
  })

const convertOuterFunction = (funk, object) => function() {
  return this.lift(funk.apply(object, arguments))
}
// Adds context to a stack member
const processProtoNew = (proto, outerProto) => {
  const protoProcessed = assign({}, proto, helpers.monadMapVals(convertOuterFunction, outerProto))
  //Update name
  protoProcessed.name = proto.name + '/' + outerProto.name
  //Add reference to outer member
  protoProcessed.outer = outerProto
  //Add default implementation of the run function
  if (typeof protoProcessed.run !== 'function') {protoProcessed.run = function (fn, val) { return fn(val)} }
  return protoProcessed
}

// A stateful version of the map function:
// f accepts an array item and a state (defaults to an object) and returns the processed version of the item plus a new state
const statefulMap = (arr, f) =>
  arr.reduce((arrayAndState, item) => {
    const itemAndState = (f(item, arrayAndState[1]))
    return [arrayAndState[0].concat([itemAndState[0]]), itemAndState[1] ]
  }, [[], {}])[0]

