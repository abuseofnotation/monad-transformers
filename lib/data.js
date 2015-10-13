exports.id = {
  name: 'ID',
  of: function (val) { return {idVal: val } },
  map: function (funk, val) {
    return {
      idVal: funk(val.idVal)
    }
  },
  flatMap: function (funk, val) {
    return val.flatMap(function (innerId) {
      return funk(innerId.idVal)
    })
  },
  lift: function (val) {
    return val.flatMap(function (innerValue) {return val.of({idVal: innerValue})})
  }
}

exports.maybe = {
  name: 'Maybe',
  of: function (val) { return {maybeVal: val } },
  map: function (funk, val) {
    return {
    maybeVal: val.maybeVal === undefined ? val.maybeVal : funk(val.maybeVal)
    }
  },
  flatMap: function (funk, val) {
    return val.flatMap(function (innerMaybe) {
      return innerMaybe.maybeVal === undefined ? innerMaybe.maybeVal : funk(innerMaybe.maybeVal)
    })
  },
  lift: function (val) {
    return val.flatMap(function (innerValue) {return val.of({maybeVal: innerValue})})
  }
}
exports.list = {
  name: 'list',
  of: function (val) {console.log(val); return val.constructor === Array ? val : [val] },
  map: function (funk, val) {
    return val.map(funk)
  },
  flatMap: function (funk, val, innerMonad) {
    return innerMonad.flatMap(function (innerList) {
      return innerList.reduce((list, val) => list.concat(funk(val)))
    }, val, innerMonad.inner)
  }
}
