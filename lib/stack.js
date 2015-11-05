module.exports = function createStack (stack) {
  stack.unshift(idProto)
  const error = new Error('The first argument must be a stack member')
  const stackProcessed = processStack(stack)
  const lift = (proto, val) => {
    const level = stack.indexOf(proto)
    if (level === -1) {throw error}
    const liftLevel = (val, level) => {
      const prevLevel = stackProcessed[level - 1]
      const nextLevel = stackProcessed[level + 1]
      if (nextLevel !== undefined) {
        return liftLevel(prevLevel.map(nextLevel.lift, val), level + 1)
      } else {
        return val
      }
    }
    return liftLevel(val, level)
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
  var prevItem
  var prevItemProcessed
  return stack.map((item) => {
    const itemProcessed = wrapProto(item, (prevItemProcessed || idProto), prevItem)
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
  },
  map (funk, val) {
    return this.chain((val)=>this.of(funk(val)), val)
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
  },
  map (funk, val) {
    return funk(val)
  }
}
