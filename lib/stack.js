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
  return processStack(stack).slice(-1)[0]
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
const asyncCompose = (thisRun, outerRun) => {
  thisRun = thisRun || function(fn, val) {return fn(val)}
  outerRun = outerRun || function(fn, val) {return fn(val)}
  return function(fn, val) {
    return thisRun.call(this, outerRun.bind(this, fn), val)
  }
}
// Adds context to a stack member
const processProtoNew = (proto, outerProto) => {
  const protoProcessed = assign({}, proto, {
    fold: asyncCompose(outerProto.fold, proto.fold),
    run: asyncCompose(proto.run, outerProto.run)
  }, helpers.monadMapVals(convertOuterFunction, outerProto))
  //Update name
  protoProcessed.name = proto.name + '/' + outerProto.name
  //Add reference to outer member
  protoProcessed.outer = outerProto
  return protoProcessed
}

// A stateful version of the map function:
// f accepts an array item and a state (defaults to an object) and returns the processed version of the item plus a new state
const statefulMap = (arr, f) =>
  arr.reduce((arrayAndState, item) => {
    const itemAndState = (f(item, arrayAndState[1]))
    return [arrayAndState[0].concat([itemAndState[0]]), itemAndState[1] ]
  }, [[], {}])[0]

