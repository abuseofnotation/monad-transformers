exports.id = {
  name: 'ID',
  of (val) { return {idVal: val } },
  chain (funk, val) {
    return val.chain((innerId) => funk(innerId.idVal))
  },
  lift (val) {
    return val.chain((innerValue) => val.of({idVal: innerValue}))
  }
}

exports.maybe = {
  name: 'Maybe',
  of (val) {
    return {maybeVal: val }
  },
  chain (funk, val) {
    return val.chain((innerMaybe) =>
      innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal))
  },
  lift (val) {
    return val.chain((innerValue) => val.of({maybeVal: innerValue}))
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
