exports.prim = require('./prim')
exports.data = require('./data')
exports.comp = require('./comp')

var id = {
  flatMap: function (funk, val) {
    return funk(val)
  }

}

exports.make = function make_monad (m1, m2) {
  m1.inner = m2 // maybe
  m2.inner = id
  var proto = {
    map: function (funk) {
      return create(m2.map(function (val) {
        return m1.map(funk, val)
      }, this._value))
    },
    flatMap: function (funk) {
      var funkk = function (val) {
        return funk(val)._value
      }
      return create(m1.flatMap(funkk, this._value, m2))
    }
  }
  function create (value) {
    var obj = Object.create(proto)
    obj._value = value
    return obj
  }

  function make (value) {
    return create(m2.of(m1.of(value)))
  }
  make.prototype = proto
  return make
}

exports.print = function print (val) {console.log(val);return val}
