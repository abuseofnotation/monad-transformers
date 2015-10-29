module.exports = function createStack(stack){
  const stackProcessed = processStack(stack) 
  const lift = (proto, val) => {
    const level = stack.indexOf(proto)
    const remainingStack = stackProcessed.slice(level + 1)
    return remainingStack.reduce((val, proto)=> proto.lift(val), val)
  }

  const wrap = (proto, val) => {
    const level = stack.indexOf(proto)
    const remainingStack = stackProcessed.slice(0, level + 1).reverse()
    return remainingStack.reduce((val, proto)=> proto.wrap(val), val)
  }
  const wrapLift = (val, proto) => lift(wrap(val, proto), proto)
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
  of: proto.of,
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

