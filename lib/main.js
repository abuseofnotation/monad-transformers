exports.prim = require('./prim')
exports.data = require('./data')
exports.comp = require('./comp')

const idProto = {
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

// Unwraps a wrapped value
const unwrap = (val) => {
  if (!val.hasOwnProperty('_value')) {throw JSON.stringify(val) + ' is not a wrapped value'}
  return val._value
}

// Wraps a value in a specified prototype
const wrapVal = (proto, val) => {
  var obj = Object.create(proto)
  obj._value = val
  return Object.freeze(obj)
}

const wrapProto = (proto, outer) => ({
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

const processStack = (stack) => {
  
}

exports.make = function make_monad (outer, inner) {
  // The constructor function creates a new object and wraps it in the stack prototype
  function create (val) {
    return wrapVal(stackProto, val)
  }

  const outerProto = wrapProto(outer, idProto)
  const innerProto = wrapProto(inner, outerProto)

  const stack = [outer, inner]
  const stackProcessed = [outerProto, innerProto]
  // Lifts a value from the outer type to a full stack
  const liftOuter = (val) => create(innerProto.lift(val))
  const liftInner = (val) => create(innerProto.wrap(val))

  const lift = (proto, val) => {
    const level = stack.indexOf(proto)
    const remainingStack = stackProcessed.slice(level + 1)
    return remainingStack.reduce((val, proto)=> proto.lift(val), val)
  }

  const wrap = (proto, val) => {
    const level = stack.indexOf(proto)
    const remainingStack = stackProcessed.slice(0, level + 1).reverse()
    debugger
    return remainingStack.reduce((val, proto)=> proto.wrap(val), val)
  }
  wrap(inner, inner.of(4))
  const wrapLift = (val, proto) => lift(wrap(val, proto), proto)

  // Define the prototype of the resulting monad stack
  const stackProto = {
    prototype: stackProto,

    // Add chain function
    chain (funk) {
      const funkAndUnwrap = (val) => unwrap(funk(val))
      return create(innerProto.chain(funkAndUnwrap, this._value))
    },

    // Add 'map' and 'of' functions
    of (value) {
      return liftOuter(outer.of(value))
    },
    map (funk) {
      return this.chain((val) => this.of(funk(val)))
    }
  }
  stackProto [ 'lift' + outer.name ] = liftOuter
  stackProto [ 'lift' + inner.name ] = liftInner

  // Add variants of 'chain' composed with lift, which work in inner and outer values
  stackProto [ 'chain' + inner.name ] = function (funk) {
    return this.chain((val) => liftInner(funk(val)))
  }
  stackProto [ 'chain' + outer.name ] = function (funk) {
    return this.chain((val) => liftOuter(funk(val)))
  }

  // Using the lift operations, lift all monad helpers and assign them to the stack object:
  const extend = (outer) => {
    Object.keys(outer)
      .filter((key) => (key !== 'of' && key !== 'chain' && key !== 'lift' && key !== 'wrap'))
      .forEach((key) => {
        stackProto[key] = function () {
          const args = Array.prototype.slice.call(arguments)
          return this.chain((val) => {
            return stackProto[ 'lift' + outer.name ](outer[key].apply(null, args.concat([val])))
          })
        }
      })
  }
  extend(outer)
  extend(inner)
  // Add aliases to the monads themselves
  stackProto [ inner.name ] = inner
  stackProto [ outer.name ] = outer

  // Add relevant prototype properties to the constructor
  create.of = stackProto.of
  create [ 'lift' + outer.name ] = stackProto [ 'lift' + outer.name ]
  create [ 'lift' + inner.name ] = stackProto [ 'lift' + inner.name ]

  // Stack constructor
  return create
}
