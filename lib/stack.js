module.exports = function createStack (stack) {
  idProto
  const error = new Error('The first argument must be a stack member')
  const stackProcessed = processStack(stack)
  const lift = (proto, val) => {
    const level = stack.indexOf(proto)
    if (level === -1) {throw error}
    const remainingStack = stackProcessed.slice(level + 1)
    debugger
    return stackProcessed[level-1].chain(val=> stackProcessed[level-1].of(stackProcessed[level+1].lift(val)), val)
  //  return remainingStack.reduce((val, proto) => proto.lift(val), val)

  }


  const wrap = (proto, val) => {
    const level = stack.indexOf(proto)
    if (level === -1) {throw error}
    return stackProcessed[level].wrap(val)
  }
  return {
    wrap: wrap,
    lift: lift,
    wrapLift: (proto, val) => lift(proto, wrap(proto, val))
  }
}

const processStack = (stack) => {
  var prevItem = idProto
  var prevItemProcessed = idProto
  return stack.map((item) => {
    const itemProcessed = wrapProto(item, prevItemProcessed, prevItem)
    prevItemProcessed = itemProcessed
    prevItem = item
    return itemProcessed
  })
}

const wrapProto = (proto, outerProcessed, outer) => ({
  name: proto.name + '/' + outerProcessed.name,
  of: (val) => outerProcessed.of(proto.of(val)),
  chain (funk, val) {
    return proto.chain(funk, val, outerProcessed)
      debugger
  },
  map(funk,val){
    return this.chain((val)=>this.of(funk(val)))
  },
  lift (val) {
    return proto.lift(val, wrapProto(outer, idProto))
  },
  wrap (val) {
    return proto.wrap(val, outerProcessed)
  }
})
const idProto = {
  name: 'root',
  // The 'of' function wraps a value in a monad.
  // In the case of the identity monad, we don't do anything, so we don't really
  // need to wrap it.
  of (val) {
    return val
  },
  // identity monad's chain implementation.
  // Since no packing and unpacking takes place,
  // all we have to do is to apply the function
  chain (funk, val) {
    return funk(val)
  }
}
