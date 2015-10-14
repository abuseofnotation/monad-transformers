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
  // identity monad's flatMap implementation.
  // Since no packing and unpacking takes place,
  // all we have to do is to apply the function
  flatMap (funk) {
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

exports.make = function make_monad (inner, outer) {
  // Create the prototype of the outer monad
  const outerProto = {
    of: outer.of,
    // Here we just take the 'flatMap' function from the monad's definition,
    // and apply it to the value, placed in the object's '_value' property
    // When we stack monad transformer must have a real at the bottom.
    // That is why we wrap our value in an ID monad
    flatMap (funk) {
      return outer.flatMap(funk, wrapIn(idProto, this))
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
    flatMap (funk) {
      const funkAndUnwrap = (val) => unwrap(funk(val))
      console.log(this)
      console.log(inner.flatMap.toString())
      return create(inner.flatMap(funkAndUnwrap, wrapIn(outerProto, this)))
    }
  }
  // Add 'map' and 'of' functions
  stackProto.of = function make (value) {
    return create(outer.of(inner.of(value)))
  }
  stackProto.map = function (funk) {
    return this.flatMap((val) => this.of(funk(val)))
  }
  // Lifts a value from the inner type to a full stack
  const liftInner = (val) => create(inner.lift(wrapIn(outerProto, val)))

  // Enrich the stack prototype with aliases to all functions, defined in the members
  stackProto [ 'lift' + inner.name ] = function (funk) {
    return this.flatMap((val) => liftInner(funk(val)))
  }
  stackProto [ 'lift' + outer.name ] = stackProto.flatMap

  // Stack constructor
  function create (value) {
    var obj = Object.create(stackProto)
    obj._value = value
    return Object.freeze(obj)
  }

  stackProto.of.prototype = stackProto
  return stackProto.of
}
