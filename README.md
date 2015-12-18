# Usage

### From CommonJS environment
Import the module and start playing:
          var mtl = require('monad-transformers')
### From browser

import one of the files from the "target" directory and use `window.mtl` to access the lib.

# Features

### Highly composable
We test every type against every other to make sure everything works together. 

### Functions all the way down
The monad transformers are implemented by just writing functions transforming one type to another. The stack may contain any value, including values coming from third party libs and the build-ins.

### Chaining API
The library features an underscore-inspired chaining API, familiar and easy-to-use for JS developers.

### Handles wrapping and unwrapping of Values.
This package contains a stack component which abstracts away the process of wrapping and unwrapping of values, thus making the types easy to write and understand.

# How to use

Call `make` to compose two or several types in a new type:

     var mtl = require('monad-transformers')
     var listMaybe = mtl.make(mtl.data.list, mtl.data.maybe)

Create an instance of the new type and use it.
  
      listMaybe.fromArray([{name: 'foo'}, {name: 'bar'}, {noname: 'baz'}])

Use the methods coming from the types that you composed:

      listMaybe.fromArray([{name: 'foo'}, {name: 'bar'}, {noname: 'baz'}])

        //Calling a 'maybe' method
        .get('name') // [maybe('foo'), maybe('bar'), maybe(undefined)]
        
        //Calling a 'list' method
        .filter(a => a.name !== 'bar') //[maybe('foo'), maybe(undefined)]
        
        //Calling a generic monad method
        .map((val)=>console.log(val)) //prints 'foo'
# Docs
[Types API](docs/api.md)
[Implementing a monad transformer](docs/implementing-transformer.md)
