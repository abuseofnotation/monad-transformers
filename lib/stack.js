module.exports = function createStack (monadStack) {
  // Generate errors
  const error = new Error('The first argument must be a stack member')

  // Add the ID monad at the bottom of the monad stack
  const stack = [idProto].concat(monadStack)

  // Perform some preprocessing on the stack
  const stackProcessed = processStack(stack)

  // Define the lift operation which takes a value of a given level of the stack and lifts it to the last level
  const lift = (val, level) => {
    // Get the stack prototypes for the previous and the next level
    const nextLevel = level + 1
    const nextMember = stackProcessed[level + 1]
    // Do not do anything if the value is already at the last level.
    if (nextMember !== undefined) {
      // Perform the lift operation at the necessary level
      // Call the function recursively to get to the next one
      //console.log(JSON.stringify(nextLevel.lift(val), 0, 4))
      return lift(nextMember.lift(val), nextLevel)
    } else {
      return val
    }
  }
  //the to operation takes a value outputted by one of the monads and lifts it as a full stack value (of + lift)
  const to = (val, level) => {
    return lift(stackProcessed[level-1].of(val), level)
  }

  // Takes funk and from it creates a stack operation, 
  const operation = (funk) => {
    return (proto, val) => {
      // Determine the level of the value, given the proto
      const level = stack.indexOf(proto)
      // Throw an error if the value is invalid
      if (level === -1) {throw error}
      return funk(val, level)
    }
  }
  //Dispatches an operation to the correct stack level
  const fromStack = (name) => {
    return (val, level) => stackProcessed[level][name](val)
  }



  return {
    lift: operation(lift),
    of: operation(fromStack('of')),
    chain: operation(fromStack('chain')),
    to: operation(to),
    last: stackProcessed[stackProcessed.length-1]
  }
}

const processStack = (baseStack) =>
  stateMap(baseStack, (item, state) => {
    const prevItemProcessed = state.prevItemProcessed || idProto
    // Apply the processing function on each stack member
    const itemProcessed = processProto(item, prevItemProcessed, state.prevItem)
    return [
        itemProcessed,
      {
        prevItemProcessed: itemProcessed,
        prevItem: item
      }
    ]
  })

// A stateful version of the map function:
// f accepts an array item and a state(defaults to an object) and returns the processed version of the item plus a new state
const stateMap = (arr, f) =>
  arr.reduce((arrayAndState, item) => {
    const itemAndState = (f(item, arrayAndState[1]))
    return [arrayAndState[0].concat([itemAndState[0]]), itemAndState[1] ]
  }, [[], {}])[0]

// Process a prototype
const processProto = (proto, outerProcessed) => ({
  // Generate a name, for debugging purposes
  name: proto.name + '/' + outerProcessed.name,
  // Generate the of function
  of (val) {
    return proto.of(val, outerProcessed)
  },
  // Generate the chain function, which applies the chain methods of the prototypes recursively
  chain (funk, val) {
    return proto.chain(funk, val, outerProcessed)
  },
  // Generate map, a syntactic sugar for chain . of
  map (funk, val) {
    return this.chain((val)=>this.of(funk(val)), val)
  },
  // Generate the lift function (it is not recursive so to allow lifting values that come from arbitrary level)
  lift (val) {
    return proto.lift(val, outerProcessed)
  },
  wrap (val) {
    return proto.wrap(val, outerProcessed)
  }
})

// The identity monad, which lies at the bottom of each stack
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
