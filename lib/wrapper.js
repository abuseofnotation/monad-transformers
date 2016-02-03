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
const assign = require('object-assign')
const helpers = require('./helpers')
const idFunc = a => a

// Unwraps a wrapped value
const unwrap = (val) => {
  if (!val.hasOwnProperty('_value')) {throw JSON.stringify(val) + ' is not a wrapped value'}
  return val._value
}

// Wraps a value in a specified prototype
const wrap = (proto, val) => {
  var obj = Object.create(proto)
  obj._value = val
  return Object.freeze(obj)
}

const monadWrapperProto = {
  chain (funk) {
    const funkAndUnwrap = (val) => {
      if(typeof funk !== 'function'){
        console.log(funk)
      }
      const newVal = funk(val)
      if (!newVal.hasOwnProperty('_value')) {throw JSON.stringify(newVal) + ' is not a wrapped value'}
      if (newVal.stack.name !== this.stack.name) {throw `${this.stack.name} is not the same as ${newVal.stack.name}`}
      return newVal._value
    }
    if (!process.debug) {
      funkAndUnwrap.toString = () => 'unwrap(' + funk.toString() + ')'
    }
    return this.constructor(this.stack.chain(funkAndUnwrap, this._value))
  },
  of (value) {
    return this.constructor(this.stack.of(value))
  },
  map (funk) {
    return this.chain((val) => this.of(funk(val)))
  },
  ap (val) { 
    return this.chain(f => val.map(f))
  },
  tap (funk) {
    return funk(this)
  },
  andThen (monad) {
    return this.chain((_) => monad)
  },
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
  //  return this.run(makeFold(callbacks || {}), environment)
  },
  debug () {
    this.run((val) => console.log(val))
    debugger
    return this
  },
  run (callback, environment) {
    return this.stack.run.call(environment, callback||idFunc, this._value)
  },
  toString () {
    return JSON.stringify(this._value)
  }
}

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

module.exports = (stack) => { 
  const monad = assign(Object.create(monadWrapperProto), helpers.monadMapVals(promoteToMethod, stack))
  const constructor = (val) => {
    var object = Object.create(monad)
    object._value = val
    return object
  }
  monad.stack = stack
  //TODO remove this
  monad.constructor = assign(constructor, helpers.monadMapVals(promoteToConstructor, stack))
  monad.constructor.of = monad.of.bind(monad)
  monad.constructor.prototype = monad
  return monad.constructor
}


/*
 * [_View in GitHub_](../lib/wrapper.js)
 */
