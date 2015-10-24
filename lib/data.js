exports.id = {
  name: 'ID',
  of (val) { return {idVal: val } },
  chain (funk, val, proto) {
    return proto.chain((innerId) => {
      return funk(innerId.idVal)
    }, val)
  },
  lift (val, proto) {
    return proto.chain((innerValue) => proto.of({idVal: innerValue}), val)
  }
}

exports.maybe = {
  name: 'Maybe',
  of (val) {
    return {maybeVal: val }
  },
  chain (funk, val, proto) {
    return proto.chain((innerMaybe) =>{
      return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal)}, val)
  },
  lift (val, proto) {
    return proto.chain((innerValue) => proto.of({maybeVal: innerValue}), val)
  },
  get (key, val) {
    return {maybeVal: val[key]}
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
