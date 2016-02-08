/* 
/* # Example Part 2 - Parametrizing our data source / Modifying REST Resources
 *
 * _Using the Reader monad._
 */
const mtl = require("../lib/main.js")
if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
const initData = require('./db_example_part_1.js').initData

const suffix = mtl.curry((suffix, str) => suffix + '/' + str)

/*
 * ## Parametrizing the data source
 *
 * In the next part of my tutorial will make functions that modify the resources that they retrieve.
 * As you can see I included some of the resources from the previous tutorial.
 * I could not reuse more of it, because of the way that the `getResource` function was written:
 */

const data = initData()
const GetResource = (url) => data.getResource.bind(null, url)

/* Namely, the function is bound to a specific data source. This means that we won't be able to test our stuff
 * the way that we want to test it because we will have to always keep track of what in our data is 
 * changed. So let's fix it:
 */

const mGetResource = (url, data) => data.getResource.bind(null, url)

/*
 * So we just parametrized the function. Easy, right. Now we just have to specify the dataSource when we call it.
 */

/*
 * However, this breaks our workflow a bit. In the previous version of the tutorial we had this beautiful
 * `getResourceFrom` function that was quite handy:
 */
const oldGetResourceFrom = (type) => (id) => 
    m.of(suffix(type, id))
    .tellMap((url) => `Retrieving ${url}... `) 
    .cont(mGetResource)
/*
 * Now, because this function calls `mGetResource`, it would also have to accept a dataSource and our whole code would 
 * start smelling bad. Unless there is a transformation that can handle this for us. 
 *
 * And as you might suspect, there actually is one.   
 *
 * The Reader monad transformation is the evil twin of the Writer monad transformation.
 * It gives us access to a immutable datastructure sometimes called 'environment' for storing all kinds of configurations.
 * throughout our computation without bothering to pass it around to each new function.
 *
 * It is like an additional parameter that you cannot change.
 *
 * In order to use the Reader monad transformer , let's first refactor our code a bit:
 */

const oldGetResourceFrom2 = (type) => (id) => 
  m.of(suffix(type, id))
    .chain((url) => m.fromContinuation(mGetResource(url)))
/*
 * Remember this? This is the first version of the function that does not use the `cont` helper. Or it is close to it anyways -
 * this one uses another helper - the `fromContinuation` constructor).
 *
 * We desugared our function in order to combine it with another helper - `loadEnvironment`.
 */

const mGetResourceFrom = (type, id) => 
  m.loadEnvironment().chain((environment) =>
    m.fromContinuation(mGetResource(suffix(type, id), environment)))

/*
 * So that is the formula for using the Reader: we use the environment whenever we need it.
 * We define the environment in the `run` method:
 * In that way we can run it against the data that we defined earlier or any other.
 */

exports.test = {}
exports.test.mGetResource = (test) => {
    mGetResourceFrom('users', 'john')
    .run((result) => {
      test.equal(result.taskSuccess.value.value.occupation, "developer")
      test.done()
    }, {environment:initData()})
  }

/*
 * ### Interlude: Monad transformers and the transformer stack
 *
 * That is all good, you might say, but why do we have to take a step back in order to use it? Why can't we still use the
 * `cont` helper. as we used to. 
 * 
 * The reason for this is that we are combining the effects of two different monad transformers. And although it may seem 
 * so from a first glance, monad transformers aren't in any way related to each other.
 *
 * A monad constructor is defined just by specifying the transformations that it uses. and the order in which the data is
 * transformed.
 *
 * For example here is a monad constructor that we can use for this tutorial:
 */

const m = mtl.make(mtl.base.task, mtl.data.maybe, mtl.data.writer, mtl.comp.reader)

/*
 * We include just the monads we need in it. And we can customize it however we like.
 * If you really want to use a given helper it is not hard to define it in terms of the other helpers.
 * Here is, for example, a function for chaining computations that use the environment (remember: `chain` 
 * and `of` are key, everything else can be defined in terms of them)
 */
m.prototype.readerCont = function (f) {
    return this.chain((val) => 
      m.loadEnvironment()
      .cont((env) => f(val, env)))
}

/*
 * Easy right? Well that is the point of the wrapper object - to serve as a container for all kinds of 
 * monad transformer functions. And once we have this one we can totally abstract away our environment in the 
 * `getResourceFrom` function:
 */

const helperGetResourceFrom = (type) => (id) => 
    m.of(suffix(type, id))
    .readerCont(mGetResource)

/*
 * Let's verify that this works before moving on:
 */

exports.test.helperGetResourceFrom = (test) => {
  helperGetResourceFrom('users')('john')
  .run((result) => {
    test.deepEqual(result.taskSuccess.value.value,{name:"John", occupation:"developer"})
    test.done()
  }, {environment:initData()})
}

/*
 * ## Posting resources
 * 
 * How would a primitive function for posting resources looks like? Here is one way 
 */
const postResourceTo = (type, id) => (resource) => m.loadEnvironment().chain((data) =>
  m.fromContinuation(data.postResource.bind(null, suffix(type, id), resource))) 
/* 
 * It is pretty easy to conceive once you understand its `get` counterpart.
 *
 * ### Interlude: Currying
 *
 * Actually there is one more think worth thinking about.
 * Do we need a function that receives a resource type and an id, and returns a resource modifier function. 
 *
 * Or do we actually want one that receives just the type and returns a function that accepts both an ID and a new version of a
 * resource? If you find yourself asking these questions, the answer is just to wrap the function in the `curry` constructor
 * and it will work both ways.
 *
 * Just remember to order your arguments from the one you know about to the one that you don't:
 */

const mPostResourceTo = mtl.curry((type, id, resource) => m.loadEnvironment().chain((data) =>
  m.fromContinuation(data.postResource.bind(null, suffix(type, id), resource))))

/*
 * After we have a functions for retrieving and posting a resource, we might combine them in many ways.
 *
 * For example let's write a function that modifies a resouce:
 */

const modifyResource = mtl.curry((type, f, id) => 
    mGetResourceFrom(type, id)
    .map(f)
    .chain(mPostResourceTo(type, id)))
  
/*
 * Keeps getting easier and easier. This allows us to modify a resource using ordinary functions like:
 */
const makeFarmer = (user) => { user.occupation = 'farmer'; return user}

/*
 * And the fact that is curried allows us to "breed" it into a thousand more-specific functions:
 */
const modifyUser = modifyResource('users')
const mMakeFarmer = modifyUser(makeFarmer)

/*
 * Beautiful. Let's test that:
 */
exports.test.modify  = (test) => {
   m.of('john').chain(mMakeFarmer)
    .run((result) => {
      test.deepEqual(result.taskSuccess.value.value,{name:"John", occupation:"farmer"})
      test.done()
    }, {environment:initData()})
}
/* I think it works
 * to be sure I want to retrieve the resource again, after I change it:
 */
exports.test.modifyAndGet  = (test) => {
   m.of('john')
     .chain(mMakeFarmer)
     .chain((_)=> mGetResourceFrom('users', 'john'))
    .run((result) => {
      test.deepEqual(result.taskSuccess.value.value,{name:"John", occupation:"farmer"})
      test.done()
    }, {environment:initData()})
}
/*
 * With `.chain((_)=>` we effectively ignore the value that we have so far.
 * This may seem weird, since we never do it with promises, for example, but here it makes sense.
 * There even is a shortcut method for this - `andThen`.
 */

exports.initData = initData

exports.mGetResourceFrom = mtl.curry((type, id, m) => 
  m.loadEnvironment().chain((environment) =>
    m.fromContinuation(mGetResource(suffix(type, id), environment))))

exports.mPostResourceTo = mtl.curry((type, id, resource, m) => m.loadEnvironment().chain((data) =>
  m.fromContinuation(data.postResource.bind(null, suffix(type, id), resource))))
