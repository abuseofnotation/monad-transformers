/* # Types API
 *
 * Here is a list of all monad transformers and the methods that they add to the wrapper object.
 *
/* ## `data.maybe`
 *
 * The `maybe` monad transformer automatically checks if your value is undefined and
 * stops the computation if it is.
 *
 * ### `value.get(key)`
 *
 * A helper to safely retrieve a possibly undefined property of your wrapped value.
 * 
 * ### `value.maybeMap(f)`
 * 
 * Chains a function that returns a `maybe` value in the computation
 *
 * ### Definition
 *
 * ![Maybe](img/maybe.png)
 *
 * ### Source
 */

//TODO use this
const nothing = {maybeVal:undefined}
exports.maybe = {
  // Standard functions
  name: 'Maybe',
  // (val) => M({maybeVal:val})
  of (val) { return this.outer.of({maybeVal: val }) },
  // (val => M({maybeVal:val}) , M({maybeVal:val})) => M({maybeVal:val})
  chain (funk, mMaybeVal) {
    return this.outer.chain((maybeVal) => {
      return maybeVal.maybeVal === undefined ? maybeVal : funk(maybeVal.maybeVal)
    }, mMaybeVal)
  },
  // (M(val)) => M({maybeVal:val})
  lift (mVal) {
    return this.outer.chain((val) => this.outer.of({maybeVal: val}), mVal)
  },
  // ((val) => otherVal, M({maybeVal:val})) => otherVal
  value (funk, mMaybeVal) {
    return this.outer.value((maybeVal) => {
      return maybeVal.maybeVal === undefined ? maybeVal : funk(maybeVal.maybeVal)
    }, mMaybeVal)
  },
  fold (fDefined, fUndefined, maybeVal) {
      return maybeVal.maybeVal === undefined ? funkUndefined() : funkDefined(maybeVal.maybeVal)
  },
  // Custom functions
  get (key, val) {
    return this.of(val[key])
  },
  maybeMap (funk, val) {
    return this.of(funk(val))
  }
}
/* 
 * [_View in GitHub_](../lib/data.js)
 */

/* ## `data.list`
 *
 * The `list` monad transformer allows you to operate on a list of values.
 * instead of on a single value.
 *
 * ### `List.fromArray(val)`
 *
 * Wraps an array in a list monad transformer instance.
 *
 * ### `values.filter(fn)`
 * 
 * Filters out the values that don't match the predicate. Same as `Array.prototype.filter`.
 * 
 * _The behaviour of `Array.prototype.map` is covered by the monad transformer `map` method._
 *
 * ### Source
 */

exports.list = {
  name: 'List',
  // Standard functions
  // (val) => M([val])
  of (val) {
    return this.outer.of([val])
  },
  // (val => M([val]) , M([val]))=> M([val])
  chain (funk, mListVal) {
    return this.outer.chain(listVal => {
      return listVal.length === 0 ? this.outer.of([]) : listVal
        .map(funk)
        .reduce((accumulatedVal, newVal) => {
          return this.outer.chain(accumulated => {
            return this.outer.chain(_new => 
              this.outer.of(accumulated.concat(_new)), newVal)
        }, accumulatedVal)
      })
    }, mListVal)
  },
  // (M(val)) => M([val])
  lift (val) {
    return this.outer.chain(innerValue => this.outer.of([innerValue]), val)
  },
  // ((val) => otherVal, M([val])) => otherVal
  value (funk, val) {
    return this.outer.value((list) => {
      return list.map(funk)
    }, val)
  },
  fold (f, accumulator, list) {
    return list.reduce((acc, val) => f(val, acc), accumulator)
  },
  // Custom functions
  filter (funk, val) {
    if (funk(val)) {
      return this.of(val)
    } else {
      return this.outer.of([])
    }
  },
  fromArray (val) {
    if (val.concat && val.map && val.reduce && val.slice) {
      return this.outer.of(val)
    } else {
      throw val + ' is not a list.'
    }
  }
}
/* 
 * [_View in GitHub_](../lib/data.js)
 */

/* ## `data.writer`
 *
 * The writer monad transformer augments the wrapped value with one additional value
 * which may be used for storing some additional information about the computation.
 *
 * The additional value must be an object that has a `concat` method (as String or Array).
 * 
 * ### `value.tell(val)`
 * 
 * Concats `val` to the additional value.
 *
 * ### `value.listen(f)`
 *
 * Calls `f` with the additional value as an argument. 
 *
 * ### Definition
 *
 * ![Writer](img/writer.png)
 *
 * ###Source
 */

const computeLog = (log, newLog) => {
  if(log === undefined) {
    return newLog
  } else {
    if (newLog === undefined) {
      return log
    } else {
      return log.concat(newLog)
    }
  }
}

exports.writer = {
  name: 'Writer',
  // Standard functions
  // (val) => M([val, log])
  of (val) {
    return this.outer.of([val, undefined])
  },

  // (val => M([val, log]), M([val, log])) => M([val, log])
  chain (funk, mWriterVal) {
    return this.outer.chain((writerVal) => {
      const val = writerVal[0]
      const log = writerVal[1] 
      const newMWriterVal = funk(val)
      return this.outer.chain((newWriterVal) => {
        const newVal = newWriterVal[0]
        const newLog = typeof newWriterVal[1] === 'function' ? newWriterVal[1](log) : newWriterVal[1]
        return this.outer.of([newVal, computeLog(log, newLog)])
      }, newMWriterVal)
    }, mWriterVal)

  },

  // (M(val) => M([val, log])
  lift (mVal) {
    return this.outer.chain((val) => this.outer.of([val, undefined]), mVal)
  },
  // ((val) => b, M([val, log])) => b
  value (funk, mWriterVal) {
    return this.outer.value((writerVal) => {
      return funk(writerVal[0])
    }, mWriterVal)
  },
  // ((val) => b, M([val, log])) => b
  fold (callbacks, writerVal) {
    (callbacks.writerLog || a=>a)(writerVal[1])
    return writerVal[0]
  },
  // Custom functions
  tell (message, val) {
    return this.outer.of([val, message])
  },
  listen (funk, val){
    return this.outer.of([val, funk])
  }
}
/* 
 * [_View in GitHub_](../lib/data.js)
 */
