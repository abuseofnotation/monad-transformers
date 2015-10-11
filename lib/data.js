exports.id = {
  name: 'id',
  of: function (val) { return {idVal: val } },
  map: function (funk, val) {
    return {
      idVal: funk(val.idVal)
    }
  },
  flatMap: function (funk, val, innerMonad) {
    return innerMonad.flatMap(function (innerId) {
      return funk(innerId.idVal)
    }, val, innerMonad.inner)
  }
}

exports.maybe = {
  name: 'maybe',
  of: function (val) { return {maybeVal: val } },
  map: function (funk, val) {
    return {
    maybeVal: val.maybeVal === undefined ? val.maybeVal : funk(val.maybeVal)
    }
  },
  flatMap: function (funk, val, innerMonad) {
    return innerMonad.flatMap(function (innerMaybe) {
      return innerMaybe.maybeVal === undefined ? innerMaybe.maybeVal : funk(innerMaybe.maybeVal)
    }, val, innerMonad.inner)
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
