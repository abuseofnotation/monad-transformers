exports.id = {
  name: 'ID',
  of (val) { return {idVal: val } },
  chain (funk, val) {
    debugger
    return val.chain((innerId) => {
      return funk(innerId.idVal)
    })
  },
  lift (val) {
    return val.chain((innerValue) => val.of(this.of(innerValue)))
  },
  wrap (val, proto) {
    return proto.of(val)
  }

}

exports.maybe = {
  name: 'Maybe',
  of (val) {
    return {maybeVal: val }
  },
  chain (funk, val) {
    return val.chain((innerMaybe) => {
      return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal)
    })
  },
  lift (val) {
    return val.chain((innerValue) => val.of(this.of(innerValue)))
  },
  get (key, val) {
    return {maybeVal: val[key]}
  },
  wrap (maybeVal, proto) {
    return proto.of(maybeVal)
  }
}
exports.list = {
  name: 'List',
  of (val) {
    return val.constructor === Array ? val : [val]
  },
  chain (funk, val) {
    return val.chain((innerList) =>
      innerList.reduce((list, val) => list.concat(funk(val)), []))
  },
  lift (val) {
    return val.chain((innerValue) =>
      val.of([innerValue]))
  }
}
