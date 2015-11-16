exports.prim = require('./prim')
exports.data = require('./data')
exports.comp = require('./comp')

const createStack = require('./stack')

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


exports.make = function make_monad (outer, inner) {
  // The constructor function creates a new object and wraps it in the stack prototype
  function create (val) {
    return wrapVal(stackProto, val)
  }
  
  const monadDefinitions = Array.prototype.slice.call(arguments)

  const stack = createStack(monadDefinitions)

  // Define the prototype of the resulting monad stack
  const stackProto = {
    prototype: stackProto,
    stack:stack,
    // Add chain function
    chain (funk) {
      const funkAndUnwrap = (val) => unwrap(funk(val))
      if(!process.debug){
        funkAndUnwrap.toString = () => 'unwrap('+ funk.toString() + ')'
      }
      return create(stack.last.chain(funkAndUnwrap, this._value))
    },
    lift(proto, val){
      return create(stack.lift(proto,val))
    },
    // Add 'map' and 'of' functions
    of (value) {
      return create(stack.last.of(value))
    },
    map (funk) {
      return this.chain((val) => this.of(funk(val)))
    }
  }
  // Using the lift operations, lift all monad helpers and assign them to the stack object:
  const extend = (outer) => {
    Object.keys(outer)
      .filter((key) => (typeof outer[key] === 'function' && key !== 'of' && key !== 'chain' && key !== 'lift' && key !== 'wrap'))
      .forEach((key) => {
        stackProto['chain'+ outer.name] = function(funk){
          return this.chain((val) =>{
            const result = funk(val)
            const f =  create(stack.to(outer, result))
            return f

          })
        }
        stackProto[key] = function () {
          const args = Array.prototype.slice.call(arguments)
          return this.chain((val) => {
            return create(stack.lift(outer.original, outer[key].apply(outer, args.concat([val]))))
          })
        }
      })
  }
  stack._members.forEach(extend)

  // Add relevant prototype properties to the constructor
  create.of = stackProto.of
  create.lift = stackProto.lift

  // Stack constructor
  return create
}

