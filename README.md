

[ ![npm](https://nodei.co/npm/monad-transformers.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/monad-transformers)

[![Build Status](https://travis-ci.org/boris-marinov/monad-transformers.svg?branch=master)](https://travis-ci.org/boris-marinov/monad-transformers)
# About this library

It is inspired by the [mtl](https://hackage.haskell.org/package/mtl) library in Haskell, but contains some JS-specific goodies.

# About monad transformers

If you don't know what a monad transformer is, relax: it is just a functor between two kleisi categories!

Joking. See [this article](http://book.realworldhaskell.org/read/monad-transformers.html).

Maybe you need to understand monads first, before you start with transformers. 
Read [this book](https://github.com/MostlyAdequate/mostly-adequate-guide) and/or
see [my other library](http://boris-marinov.github.io/funktion/).


# Features 

- **Highly composable** - Every monad transformer works together with every other. 
- **Functions all the way down** - The monad transformers are defined by just writing functions transforming one type to another. The stack may contain any value, including values coming from third party libs and the build-ins.
- **Chaining API** - The library features an chaining API, inspired by [underscore.js](http://underscorejs.org/#chaining)
, familiar and easy-to-use for JS developers.
- **Automatic wrapping and unwrapping of Values** - This package contains a stack component which abstracts away the process of wrapping and unwrapping of values, thus making the types easy to write and understand.

# Quick tutorial

Call `mtl.make` to compose two or several types in a new type:

     var mtl = require('monad-transformers')
     var listMaybe = mtl.make(mtl.data.list, mtl.data.maybe)

Create an instance of the new type and use it.
  
      listMaybe.fromArray([{name: 'foo'}, {name: 'bar'}, {noname: 'baz'}])

Use the methods coming from the types that you composed:

      listMaybe.fromArray([{name: 'foo'}, {name: 'bar'}, {noname: 'baz'}])

        //Calling a 'maybe' method
        .maybeGet('name') // [maybe('foo'), maybe('bar'), maybe(undefined)]
        
        //Calling a 'list' method
        .filter(a => a.name !== 'bar') //[maybe('foo'), maybe(undefined)]
        
        //Calling a generic monad method
        .map((val)=>console.log(val)) //prints 'foo'

# Slow tutorial
  1. [Using the monad stack. Using the Task monad, the Maybe monad and the Writer monad.](docs/tutorial/p1.md)
  2. [Using the monad stack. Using the Reader monad.](docs/tutorial/p2.md)
  2. [Creating and using custom monads.](docs/tutorial/p3.md)
  
# Docs
* [Overview](docs/overview.md)
* [Object wrapper API](docs/wrapper.md)
* [Types API](docs/api.md)
* [Implementing a monad transformer](docs/implementing-transformer.md)
