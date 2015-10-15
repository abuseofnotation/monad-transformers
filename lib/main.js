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

const unwrap = (val) => (typeof val === 'object' && val.hasOwnProperty('_value')) ? val._value : val

const wrapIn = (proto, val) => {
  var obj = Object.create(proto)
  // Handle both wrapped and unwrapped values.
  obj._value = unwrap(val)
  return obj
}

exports.make = function make_monad (outer, inner) {
  // Create the prototype of the outer monad
  const outerProto = {
    of: outer.of,
    // Here we just take the 'chain' function from the monad's definition,
    // and apply it to the value, placed in the object's '_value' property
    // When we stack monad transformer must have a real at the bottom.
    // That is why we wrap our value in an ID monad
    chain (funk) {
      return outer.chain(funk, wrapIn(idProto, this))
    }
  }

  // Define the prototype of the resulting monad stack
  var stackProto = {
    prototype: stackProto,
    map (funk) {
      return create(outer.map(function (val) {
        return inner.map(funk, val)
      }, this._value))
    },
    chain (funk) {
      const funkAndUnwrap = (val) => unwrap(funk(val))
      return create(inner.chain(funkAndUnwrap, wrapIn(outerProto, this)))
    }
  }
  // Add 'map' and 'of' functions
  stackProto.of = function make (value) {
    return create(outer.of(inner.of(value)))
  }
  stackProto.map = function (funk) {
    return this.chain((val) => this.of(funk(val)))
  }
  // Lifts a value from the outer type to a full stack
  var liftOuter = stackProto [ 'lift' + outer.name ] = (val) => create(inner.lift(wrapIn(outerProto, val)))
  var liftInner = stackProto [ 'lift' + inner.name ] = (val) => create(outer.of(inner))

  // a variant of 'chain' which works in an inner function
  stackProto [ 'chain' + inner.name ] = function (funk) {
    return this.chain((val) => liftInner(funk(val)))
  }
  stackProto [ 'chain' + outer.name ] = function (funk) {
    return this.chain((val) => liftOuter(funk(val)))
  }
  stackProto [ inner.name ] = inner
  stackProto.inner = inner
  stackProto [ outer.name ] = outer

  // Enrich the stack prototype with aliases to all functions, defined in the members
  stackProto [ 'chain' + outer.name ] = stackProto.chain

  // Stack constructor
  function create (value) {
    var obj = Object.create(stackProto)
    obj._value = value
    return Object.freeze(obj)
  }

  stackProto.of.prototype = stackProto
  return stackProto.of
}
