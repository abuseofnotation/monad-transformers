# About monad transformers

Monad transformers are composable monads. They are cool. See 
[this article](http://book.realworldhaskell.org/read/monad-transformers.html).

Maybe you need to understand monads first, before you start with transformers. For this, see [my other library](http://boris-marinov.github.io/funktion/).

# About this library

It is inspired by the [mtl](https://hackage.haskell.org/package/mtl) library in Haskell, but contains some JS-specific goodies:

### Highly composable
We test every monad transformer type against every other to make sure everything works together. 

### Functions all the way down
The monad transformers are defined by just writing functions transforming one type to another. The stack may contain any value, including values coming from third party libs and the build-ins.

### Chaining API
The library features an chaining API, inspired by [underscore.js](http://underscorejs.org/#chaining)
, familiar and easy-to-use for JS developers.

### Handles wrapping and unwrapping of Values.
This package contains a stack component which abstracts away the process of wrapping and unwrapping of values, thus making the types easy to write and understand.


# Quick tutorial

## Installing

### From CommonJS environment
Import the module and start playing:
          var mtl = require('monad-transformers')
### From browser
import one of the files from the "target" directory and use `window.mtl` to access the lib.

## Getting started

Call `mtl.make` to compose two or several types in a new type:

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

But better read the docs first:

# Docs
* [Overview](docs/overview.md)
* [Object wrapper API](docs/wrapper.md)
* [Types API](docs/api.md)
* [Implementing a monad transformer](docs/implementing-transformer.md)
