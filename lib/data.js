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
  run (funk, val) {
    return this.outer.run((innerMaybe)=>{
      return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal)
    }, val)
  },
  get (key, val) {
    return this.of(val[key])
  },
  chainMaybe(funk, val){
    return this.outer.of(funk(val))
  }
}
