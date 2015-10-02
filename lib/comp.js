exports.promise = {
  name: 'promise',
  of: function (val) {return function (resolve) { return resolve(val)} },
  map: function (funk, val) {
    return function (resolve) {
      val(function (value) {
        return resolve(funk(value))
      })
    }
  },

  flat: function (val, innerMonad) {
    return function (resolve) {
      val(function (i) {
        innerMonad.map(function (innerPromise) {
          innerPromise(function (value) {
            resolve(innerMonad.map(function () {return value}, i))
          })
        }, i)

      })
    }
  }
}
