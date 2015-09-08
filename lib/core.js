
exports.prim = require("prim")
exports.data = require("data")
exports.comp = require("comp")

exports.make = function make_monad(m1, m2){
        var proto = {
                map:function(funk){
                        return create(m2.map(function(val){
                             return m1.map(funk,val)
                        }, this._value))
                },
                flatMap:function(funk){
                    var funkk = function(val){
                        return funk(val)._value
                    }
                    return create( m2.flatMap(function(val){
                             return m1.flatMap( funkk , val, m2)
                        }, this._value, m1  ))
                }
        }
        function create(value){
                var obj = Object.create(proto)
                obj._value = value
                return obj
        }
        
        function make(value){
                return create(m2.of (m1.of(value) ))
        }
        make.prototype = proto
        return make
}

exports.print = function print(val){console.log(val);return val}



