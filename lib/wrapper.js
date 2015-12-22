const createStack = require('./stack')

// Object.assign polyfil
if (!Object.assign) {
  Object.defineProperty(Object, 'assign', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function (target) {
      'use strict'
      if (target === undefined || target === null) {
        throw new TypeError('Cannot convert first argument to object')
      }

      var to = Object(target)
      for (var i = 1; i < arguments.length; i++) {
        var nextSource = arguments[i]
        if (nextSource === undefined || nextSource === null) {
          continue
        }
        nextSource = Object(nextSource)

        var keysArray = Object.keys(nextSource)
        for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
          var nextKey = keysArray[nextIndex]
          var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey)
          if (desc !== undefined && desc.enumerable) {
            to[nextKey] = nextSource[nextKey]
          }
        }
      }
      return to
    }
  })
}

// Checks if a given property is part of the general monad definition interface
const isReserverMonadKey = (key) => key !== 'name' && key !== 'map' && key !== 'of' && key !== 'chain' && key !== 'lift' && key !== 'value'

// Maps the values of a given obj excluding the reserved ones.
const monadMapVals = (funk, obj) => {
  return Object.keys(obj)
    .filter(isReserverMonadKey)
    .reduce((newObj, key) => {
      newObj[key] = funk(obj[key], obj)
      return newObj
    }, {})
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

module.exports = function make_monad () {
  // Initilize the stack component, that actually does most of the work
  const stack = createStack(Array.prototype.slice.call(arguments))

  // Define the prototype of the resulting monad stack
  const baseStackProto = {
    stack: stack,
    prototype: this.prototype,
    // Add chain function
    chain (funk) {
      const funkAndUnwrap = (val) => unwrap(funk(val))
      if (!process.debug) {
        funkAndUnwrap.toString = () => 'unwrap(' + funk.toString() + ')'
      }
      return create(stack.last.chain(funkAndUnwrap, this._value))
    },
    lift (proto, val) {
      return create(stack.lift(proto, val))
    },
    // Add 'map' and 'of' functions
    of (value) {
      return create(stack.last.of(value))
    },
    map (funk) {
      return this.chain((val) => this.of(funk(val)))
    },
    tap (funk) {
      return funk(this)
    },
    value (callback) {
      callback = callback !== undefined ? callback : a => a
      return stack.last.value(callback, this._value)
    }
  }

  // Promotes a method from a monad definition so it can be used as a static method
  const toInstance = (funk, outer) => function () {
    const args = Array.prototype.slice.call(arguments)
    return this.chain((val) => {
      return create(stack.lift(outer.original, funk.apply(outer, args.concat([val]))))
    })
  }

  // Augment the stack prototype with helper methods
  const stackProto = Object.assign.apply(null, [baseStackProto].concat(stack._members.map(monad => monadMapVals(toInstance, monad))))

  // The constructor function creates a new object and wraps it in the stack prototype
  const create = (val) => {
    return wrapVal(stackProto, val)
  }

  // Add relevant methods from the monadic interface to the stack constructor
  create.of = stackProto.of
  create.lift = stackProto.lift
  create.prototype = stackProto

  // Promotes a method from a monad definition so it can be used as a static method
  const toConstructor = (funk, outer) => function () {
    return create(stack.lift(outer.original, funk.apply(outer, arguments)))
  }
  // Augment the stack constructor with helper methods
  return Object.assign.apply(null, [create].concat(stack._members.map(monad => monadMapVals(toConstructor, monad))))
}
