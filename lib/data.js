exports.id = {
  name: 'id',
  of: function (val) { return {idVal: val } },
  map: function (funk, val) {
    return {
      idVal: funk(val.idVal)
    }
  },
  flatMap: function (funk, val, innerMonad) {
    return {
      idVal: innerMonad.flatMap(function (innerId) {
        return funk(innerId.idVal)
      }, val.idVal)
    }
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
    return {
      maybeVal: innerMonad.flatMap(function (innerMaybe) {
        return innerMaybe.maybeVal === undefined ? val.maybeVal : funk(val.maybeVal)
      }, val.maybeVal)
    }
  }
}
