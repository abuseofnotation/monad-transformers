# monad-transformers
A JS implementation of all majour monad transformers.

# Features

### Highly composable
We test every type with every other, to make sure everything works together. 

### Functions all the way down
The monad transformers are implemented by just writing functions between one type and another. The stack may contain any value, including values coming from third party libs and the build-ins.

### Chaining API
The library features an underscore-inspired chaining API, familiar and easy-to-use for JS developers.

### Handles wrapping and unwrapping of Values.
This package contains a stack component which abstracts away the process of wrapping and unwrapping of values, thus making the types easy
to write and understand.

# How to use

Call `sonne.make` to composes two or several types in a new type:

  var listMaybe = sonne.make(sonne.data.list, sonne.data.maybe)

Create an instance of the new type and use it.
  
  listMaybe.fromArray([{name: 'foo'}, {name: 'bar'}, {name: 'baz'}])
    .get('name') // maybe.get
    .map(spy) // ['foo', 'bar', 'baz']

exports.listMaybeFilter = (test) => {
  var listMaybe = sonne.make(sonne.data.list, sonne.data.maybe)
  var spy = sinon.spy((a) => a)
  listMaybe.fromArray([{name: 'foo'}, {name: 'bar'}, {name: 'baz'}])
    .filter(a => a.name === 'foo')
    .map(spy)

  test.deepEqual(spy.returnValues, [{name:'foo'}])
  test.done()
}
global.list = module.exports
