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
 */

const assign = require('object-assign')
const helpers = require('./helpers')
const idFunc = a => a

// Promotes a function from a monad definition to a monad stack method, so it can be used for chaining
const promoteToMethod = (funk, monadDefinition) => function () {
  const args = Array.prototype.slice.call(arguments)
  return this.chain((val) => {
    return this.constructor(funk.apply(monadDefinition, args.concat([val])))
  })
}

// Promotes a function from a monad definition to a stack constructor
const promoteToConstructor = (funk, monadDefinition) => function () {
  return this(funk.apply(monadDefinition, arguments))
}

/*
 * The function returns an `objectWrapper` which allows you instantiate monads from all kinds of values.
 */
 
module.exports = (stack) => { 
  const monad = assign(Object.create(monadWrapperProto), helpers.monadMapVals(promoteToMethod, stack))
  const constructor = (val) => {
    var object = Object.create(monad)
    object._value = val
    return object
  }
  monad.stack = stack
  monad.constructor = assign(constructor, helpers.monadMapVals(promoteToConstructor, stack))
  monad.constructor.of = monad.of.bind(monad)
  monad.constructor.prototype = monad
  return monad.constructor
}

/*
 * ## Creating monads
 *
 * Monads are generally created using [type-specific methods](api.md) like `fromArray` (for stacks that include the
 * list transformation, or `fromState` (for stateful computations) but several generic methods are also provided.
 *
 * ### `objectWrapper.of(value)`
 *
 * Constructs a monad from a plain non-monadic value.
 */

const monadWrapperProto = {
  of (value) {
    return this.constructor(this.stack.of(value))
  },

/* ### `objectWrapper(value)`
 *
 * Constructs a monad from a value which obeys the structure of the monad stack i.e. it "wraps" the value
 * into a monadic interface.
 *
 * ## Using monads
 *
 * Again there are many methods that you would use to manipulate a monad which are [type-specific](api.md). 
 * Here are the generic ones:
 *
 * ###`monad.chain(f)`
 *
 * Applies `f` to the value or values that are inside the monad and returns a new wrapped object
 *
 */
  chain (f) {
    const fUnwrap = (val) => {
      const newVal = f.call(this.constructor, val, this.constructor)
      if (!newVal.hasOwnProperty('_value')) {throw JSON.stringify(newVal) + ' is not a wrapped value'}
      if (newVal.stack.name !== this.stack.name) {throw `${this.stack.name} is not the same as ${newVal.stack.name}`}
      return newVal._value
    }
    return this.constructor(this.stack.chain(fUnwrap, this._value))
  },
/*
 * ###`monad.map(f)`
 *
 * Applies `f` to the value or values that are inside the monad and wraps the resulting value in a new monad instance.
 *
 */
  map (funk) {
    return this.chain((val) => this.of(funk(val)))
  },

/*
 * ###`monad.tap(f)`
 *
 * Applies the f to the monad and returns the result.
 *
 */
  tap (funk) {
    return funk(this)
  },

/* ###`monad.run()`
 *
 * Runs the computation inside the monad and calls the callback with the resulting value.
 * Does not unwrap the value.
 *
 */
  run (callback, environment) {
    return this.stack.run.call(environment, callback||idFunc, this._value)
  },

/* ###`monad.value()`
 *
 * Runs the computation inside the monad and calls the callback with the resulting value.
 * Unwraps the value using the `fold` functions.
 *
 */
  value (callbacks, environment) {
    const stack = this.stack
    return this.run((val) => {
      return stack.fold.call(callbacks, (val) => {
        if(typeof callbacks === 'function') {
          callbacks(val)
        }else if (typeof callbacks === 'object' && typeof callbacks.onValue === 'function'){
          callbacks.onValue(val)
        }
        return val
      }, val)
    }, environment)
  },
/* 
 * ###`monad.ap()`
 *
 * Applies a wrapped function to a wrapped value.
 * Same as `<@>` in Haskell.
 */
  ap (val) { 
    return this.chain(f => val.map(f))
  },
/* 
 * ###`monad.andThen()`
 *
 * Same as `chain` but accepts a wrapped value instead a function that returns one.
 * Same as `>>>` in Haskell.
 */
  andThen (monad) {
    return this.chain((_) => monad)
  },
/* 
 * ###`monad.debug()`
 *
 * A shortcut for inserting a breakpoint in the computation.
 */
  debug () {
    debugger
    return this
  }
}

/*
 * For more information, see the [Fantasy Land spec](https://github.com/fantasyland/fantasy-land).
 *
 * [_View in GitHub_](../lib/wrapper.js)
 */
