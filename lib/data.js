exports.id = {
  name: 'ID',
  of (val) { return {idVal: val } },
  chain (funk, val) {
    return val.chain(function (innerId) {
      return funk(innerId.idVal)
    })
  },
  lift (val) {
    return val.chain(function (innerValue) {return val.of({idVal: innerValue})})
  }
}

exports.maybe = {
  name: 'Maybe',
  of (val) { return {maybeVal: val } },
  chain (funk, val) {
    return val.chain(function (innerMaybe) {
      val
      return innerMaybe.maybeVal === undefined ? innerMaybe : funk(innerMaybe.maybeVal)
    })
  },
  lift (val) {
    return val.chain(function (innerValue) {return val.of({maybeVal: innerValue})})
  },
  nothing () { return {maybeValue: undefined}},
  get (key, val) { return {maybeVal: val[key]}}
}
exports.list = {
  name: 'list',
  of (val) {console.log(val); return val.constructor === Array ? val : [val] },
  chain (funk, val, innerMonad) {
    return innerMonad.chain(function (innerList) {
      return innerList.reduce((list, val) => list.concat(funk(val)))
    }, val, innerMonad.inner)
  }
}
