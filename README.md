# monad-transformers
A JS implementation of all majour monad transformers.

## Features

### Highly composable
We test every type with every other, to make sure everything works together. 

### Functions all the way down
The monad transformers are implemented by just writing functions between one type and another. The stack may contain any value, including values coming from third party libs and the build-ins.

### Chaining API
The library features an underscore-inspired chaining API, familiar and easy-to-use for JS developers.

### Handles wrapping and unwrapping of Values.
This package contains a stack component which abstracts away the process of wrapping and unwrapping of values, thus making the types easy
to write and understand.

## How to use

### Create a type

  var maybeList = sonne.make(sonne.data.maybe, sonne.data.list)
