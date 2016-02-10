const base = require('./base')
const assign = require('object-assign')
const helpers = require('./helpers')
const wrapper = require('./wrapper')

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
  helpers.statefulMap(baseStack, (item, state) => {
    const itemProcessed = addConstructor(processProtoNew(item, state))
    return [itemProcessed,itemProcessed]
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
const addConstructor = (object) => {
  object.constructor = wrapper(object)
  return object
}

// Adds context to a stack member
const processProtoNew = (proto, outerProto) =>
  assign({}, proto, {
    fold: asyncCompose(outerProto.fold, proto.fold),
    run: asyncCompose(proto.run, outerProto.run),
    outer: outerProto,
    name: proto.name + '/' + outerProto.name
  }, helpers.monadMapVals(convertOuterFunction, outerProto))

