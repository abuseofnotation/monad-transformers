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
  chain (funk) {
    return funk(this._value)
  }
}

// Unwraps a wrapped value
const unwrap = (val) => {
  if (!val.hasOwnProperty('_value')) {throw JSON.stringify(val) + ' is not a wrapped value'}
  return val._value
}

// Unwraps a value and wraps it again in a specified prototype
const wrapIn = (proto, val) => {
  var obj = Object.create(proto)
  obj._value = val
  return obj
}

exports.make = function make_monad (outer, inner) {
  function create (value) {
    var obj = Object.create(stackProto)
    obj._value = value
    return Object.freeze(obj)
  }

  // Create the prototype of the outer monad
  const outerProto = {
    of: outer.of,
    // Here we just take the 'chain' function from the monad's definition,
    // and apply it to the value, placed in the object's '_value' property
    // When we stack monad transformer must have a real at the bottom.
    // That is why we wrap our value in an ID monad
    chain (funk) {
      return outer.chain(funk, wrapIn(idProto, this._value))
    }
  }

  // Define the prototype of the resulting monad stack
  var stackProto = {
    prototype: stackProto,

    // Add chain function
    chain (funk) {
      const funkAndUnwrap = (val) => unwrap(funk(val))
      return create(inner.chain(funkAndUnwrap, wrapIn(outerProto, this._value)))
    },

    // Add 'map' and 'of' functions
    of (value) {
      return create(outer.of(inner.of(value)))
    },
    map (funk) {
      return this.chain((val) => this.of(funk(val)))
    }
  }

  // Lifts a value from the outer type to a full stack
  const liftOuter = stackProto [ 'lift' + outer.name ] = (val) => create(inner.lift(wrapIn(outerProto, val)))
  const liftInner = stackProto [ 'lift' + inner.name ] = (val) => create(outer.of(val))

  // Add variants of 'chain' which works in an inner and outer values
  stackProto [ 'chain' + inner.name ] = function (funk) {
    return this.chain((val) => liftInner(funk(val)))
  }
  stackProto [ 'chain' + outer.name ] = function (funk) {
    return this.chain((val) => liftOuter(funk(val)))
  }

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
