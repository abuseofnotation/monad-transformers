exports.curry = function curry(funk, initial_arguments){
	var context = this
	return function(){  
		var all_arguments = (initial_arguments||[]).concat(Array.prototype.slice.call(arguments, 0))
		return all_arguments.length>=funk.length?funk.apply(context, all_arguments):curry(funk, all_arguments)
	}
}

exports.compose = function(){
	//Convert functions to an array and flip them (for right-to-left execution)
	var functions = Array.prototype.slice.call(arguments).reverse()
	//Check if input is OK:
	functions.forEach(function(funk){if(typeof funk !== "function"){throw new TypeError(funk+" is not a function" )}})
	//Return the function which composes them
	return function(){
		//Take the initial input
		var input = arguments
		var context
		return functions.reduce(function(return_result, funk, i){ 
			//If this is the first iteration, apply the arguments that the user provided
			//else use the return result from the previous function
			return (i ===0?funk.apply(context, input): funk(return_result))
			//return (i ===0?funk.apply(context, input): funk.apply(context, [return_result]))
		}, undefined)
	}
}
//
//combines an array of async functions with signature into one functions.
// [ (callback, value) => () ] => (value) => ()
exports.asyncCompose = (functions, self) => functions.reduce((f, newF) => {
  return (val) => newF.call(self, f, val)
})
const baseMonadFunctions = ['of', 'chain', 'lift']

const optionalMonadFunctions = ['fold', 'run', 'value', 'map', 'outer', 'name']

const isIn = (arr) => (val) => arr.indexOf(val) === -1

// Checks if a given property is part of the general monad definition interface
const isReserverMonadKey = isIn(baseMonadFunctions.concat(optionalMonadFunctions))

// Maps the values of a given obj excluding the reserved ones.
exports.monadMapVals = (funk, obj) => {
  return Object.keys(obj)
    .filter(isReserverMonadKey)
    .reduce((newObj, key) => {
      newObj[key] = funk(obj[key], obj)
      return newObj
    }, {})
}

// A stateful version of the map function:
// f accepts an array item and a state (defaults to an object) and returns the processed version of the item plus a new state
exports.statefulMap = (arr, f) =>
  arr.reduce((arrayAndState, item) => {
    const itemAndState = (f(item, arrayAndState[1]))
    return [arrayAndState[0].concat([itemAndState[0]]), itemAndState[1] ]
  }, [[], {}])[0]

