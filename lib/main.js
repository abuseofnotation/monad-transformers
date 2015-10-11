exports.prim = require('./prim')
exports.data = require('./data')
exports.comp = require('./comp')

// The ID monad is at the bottom of each monad stack
const id = {
  of: function (val) {
    return val
  },
  map: function (funk, val) {
    return funk(val)
  },
  flatMap: function (funk, val) {
    return funk(val)
  }
}

exports.make = function make_monad (m1, m2) {
  m1.inner = m2
  m2.inner = id

  function idFlatMap (funk) {
    return funk(this._value)
  }

  function m2FlatMap (funk) {
    return m2.flatMap(funk, { flatMap: idFlatMap, _value: this._value })
  }

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
      return create(m1.flatMap(funkk, {
        flatMap: m2FlatMap,
        _value: this._value
      }))
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
