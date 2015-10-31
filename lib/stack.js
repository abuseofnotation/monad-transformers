module.exports = function createStack(stack){
  const stackProcessed = processStack(stack) 
  const lift = (proto, val) => {
    const level = stack.indexOf(proto)
    const remainingStack = stackProcessed.slice(level + 1)
    return remainingStack.reduce((val, proto)=> proto.lift(val), val)
  }
  
  const wrap = (proto, val) => {
    const level = stack.indexOf(proto)
    //const remainingStack = stackProcessed.slice(0, level + 1).reverse()
    //return remainingStack.reduce((val, proto)=> proto.wrap(val), val)
    return stackProcessed[level].wrap(val)
  }
  return {
    wrap:wrap,
    lift:lift,
    wrapLift:(proto, val) => lift(proto, wrap(proto, val))
  }
}

const processStack = (stack) => {
  var prevItem = idProto  
  return stack.map((item) => {
    const itemProcessed = wrapProto(item, prevItem)
    prevItem = itemProcessed
    return itemProcessed
  }) 
}

const wrapProto = (proto, outer) => ({
  name: proto.name + '/' + outer.name,
  of: (val) => outer.of(proto.of(val)),
  chain (funk, val) {
    return proto.chain(funk, val, outer)
  },
  lift (val) {
    return proto.lift(val, outer)
  },
  wrap (val) {
    return proto.wrap(val, outer)
  }
})
const idProto = {
  name:"root",
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


