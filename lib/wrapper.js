/* # The object wrapper
 *
 * This library provides a module which allows you to combine several monad transformer definitions
 * and create a object-oriented wrapper for using the resulting monad.
 * 
 * ## Creating a monad constructor
 *
 * You can create a monad constructor using the `mtl.make` function:
 *
 * ###`mtl.make([baseMonad], monadTransformer1, monadTransformer2)`
 *
 * ####`baseMonad - monadDefinition`
 *
 * Optionally you can pass the definition of the monad that would sit at the bottom of the stack, 
 * as a first argument of the `make` function.
 *
 * The parameter is optional. By default, the package uses the identity monad as a base.
 *
 * ####`monadTransformer<1-n> - monadTransformerDefinition`
 *
 * Pass the definitions of the monad transformers which would augment the base monad. 
 * Note that monad transformations are usually not commutative so the order in which the arguments
 * are placed matters.
 *
 * The function returns an `objectWrapper` which allows you instantiate monads from all kinds of values.
 *
 * ## Creating monads
 *
 * Monads are generally created using [type-specific methods](api.md) like `fromArray` (for stacks that include the
 * list transformation, or `fromState` (for stateful computations) but several generic methods are also provided.
 *
 * ### `objectWrapper.of(value)`
 *
 * Constructs a monad from a plain non-monadic value.
 *
 * ### `objectWrapper.lift(monadTransformerDefinition, value)`
 *
 * Constructs a monad from a value created at a higher level of the stack. See 
 * [this article](https://en.wikibooks.org/wiki/Haskell/Monad_transformers#Lifting) for more information.
 *
 * ### `objectWrapper(value)`
 *
 * Constructs a monad from a value which obeys the structure of the monad stack i.e. it "wraps" the value
 * into a monadic interface.
 *
 * ## Using monads
 *
 * Again there are many methods that you would use to manipulate a monad which are [type-specific](api.md). 
 * Here are the generic ones:
 *
 * ###`monad.map(f)`
 *
 * Applies `f` to the value or values that are inside the monad and wraps the resulting value in a new monad instance.
 *
 * ###`monad.chain(f)`
 *
 * Applies `f` to the value or values that are inside the monad and returns a new monad instance
 *
 * ###`monad.tap(f)`
 *
 * Applies the f to the monad and returns the result.
 *
 * ###`monad.value()`
 *
 * Runs the computation inside the monad and returns its value, if applicable.
 *
 * For more information, see the [Fantasy Land spec](https://github.com/fantasyland/fantasy-land).
 *
 * ## Source
 */
const createStack = require('./stack')

// Checks if a given property is part of the general monad definition interface
const isReserverMonadKey = (key) => key !=='run' && key !== 'fold' && key !== 'name' && key !== 'map' && key !== 'of' && key !== 'chain' && key !== 'lift' && key !== 'value'

//combines an array of async functions with signature into one functions.
// [ (callback, value) => () ] => (value) => ()
const asyncCompose = (functions) => functions.reduce((f, newF) => {
  return (val) => newF(f, val)
})

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

const idFunc = (a) => a

module.exports = function make () {
  // Initilize the stack component, that actually does most of the work
  const stack = createStack(Array.prototype.slice.call(arguments))
  
  //Collect the default run functions
  const runFunctions = stack._members.map((a)=>a.run)

  //Create a function that runs the monad stack with the specified callback
  const makeRunner = (callback) => asyncCompose([callback].concat(runFunctions))

  //Collect the default fold functions
  const foldFunctions = stack._members.map((a)=>a.fold).reverse()

  //Create a function that folds the monad stack
  const makeFold = (callbacks) => {
    const foldFunctionsBound = foldFunctions.map((a)=>a.bind(null, callbacks))
    return asyncCompose([idFunc].concat(foldFunctionsBound))
  }

  // Define the prototype of the resulting monad stack
  const baseStackProto = {
    stack: stack,
    prototype: this.prototype,
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
    of (value) {
      return create(stack.last.of(value))
    },
    map (funk) {
      return this.chain((val) => this.of(funk(val)))
    },
    tap (funk) {
      return funk(this)
    },
    value (callbacks) {
      return  this.run(makeFold(callbacks || {}))
    },
    run (callback) {
      const runFunction = makeRunner(callback !== undefined ? callback : a => a)
      return runFunction(this._value)
    },
    toString () {
      return JSON.stringify(this._value)
    }
  }

  // Promotes a function from a monad definition to a monad stack method, so it can be used for chaining
  const promoteToMethod = (funk, outer) => function () {
    const args = Array.prototype.slice.call(arguments)
    return this.chain((val) => {
      return create(stack.lift(outer.original, funk.apply(outer, args.concat([val]))))
    })
  }

  // Promotes a function from a monad definition to a stack constructor
  const promoteToConstructor = (funk, outer) => function () {
    return create(stack.lift(outer.original, funk.apply(outer, arguments)))
  }

  // Augment the stack prototype with helper methods
  const stackProto = Object.assign.apply(null, [baseStackProto].concat(stack._members.map(monad => monadMapVals(promoteToMethod, monad))))

  // The constructor function creates a new object and wraps it in the stack prototype
  const create = (val) => {
    return wrapVal(stackProto, val)
  }

  // Add relevant methods from the monadic interface to the stack constructor
  create.of = stackProto.of
  create.lift = stackProto.lift
  create.prototype = stackProto

  // Augment the stack constructor with helper methods
  return Object.assign.apply(null, [create].concat(stack._members.map(monad => monadMapVals(promoteToConstructor, monad))))
}

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

/*
 * [_View in GitHub_](../lib/wrapper.js)
 */
