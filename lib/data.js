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
