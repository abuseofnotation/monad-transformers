exports.maybe = {
  name: 'Maybe',
  of (val) { return this.outer.of({maybeVal: val }) },
  chain (funk, val) {
    return this.outer.chain((innerMaybe) => {
      return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal)
    }, val)
  },
  lift (val) {
    return this.outer.chain((innerValue) => this.outer.of({maybeVal: innerValue}), val)
  },
  value (funk, val) {
    return this.outer.value((innerMaybe) => {
      return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal)
    }, val)
  },
  get (key, val) {
    return this.of(val[key])
  },
  chainMaybe (funk, val) {
    return this.outer.of(funk(val))
  }
}
exports.list = {
  name: 'List',
  of (val) {
    return this.outer.of([val])
  },
  chain (funk, val) {
    // TODO - reduce this to something more readable
    return this.outer.chain(innerVal => {
      return innerVal.reduce((accumulatedVal, newVal) => {
        return this.outer.chain(accumulated => {
          return this.outer.chain(_new => this.outer.of(accumulated.concat(_new)), funk(newVal))
        }, accumulatedVal)
      }, this.outer.of([]))
    }, val)
  },
  lift (val) {
    return this.outer.chain(innerValue => this.outer.of([innerValue]), val)
  },
  value (funk, val) {
    return this.outer.value((list) => {
      return list.map(funk)
    }, val)
  },
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
        //Gotta have them null checks
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

  tell (message, val) {
    return this.outer.of([val, message])
  },
  listen (funk, val){
    return this.outer.of([val, funk])
  }
}
