/* 
/* # Modifying REST Resources / Parametrizing our data source 
 *
 * #### Using the monad stack. Using the `Reader` monad.
 *
 * _This is part 2 from the `monad-transformers` tutorial. See also [part 1](p1.md) and [part 3](p3.md)._
 *
 *
 * In the previous chapter we defined some functions for retrieving resources from REST endpoints.
 * Now we will produce some functions that modify the resources they retrieve.
 */
const mtl = require("../lib/main.js")
if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
const initData = require('./p1.js').initData

const suffix = mtl.curry((suffix, str) => suffix + '/' + str)

/*
 * ## Parametrizing the datasource
 *
 * Let's start by improving what we have so far.
 * As you can see I included some of the resources from the previous tutorial, however
 * I could not reuse more of it, because of the way that the `getResource` function was written:
 * Namely, the function is bound to a specific data source. This means that we won't be able to reuse it
 * because we will have to always keep track of what in our data is changed. 
 */

const data = initData()
const GetResource = (url) => data.getResource.bind(null, url)

/*
 * So let's fix it:
 */

const mGetResource = (url, data) => data.getResource.bind(null, url)

/*
 * So we just parametrized the function. Easy, right? Now we just have to specify which datasource
 * we want to access when we call it.
 *
 * However, this breaks our workflow a bit. In the previous version of the tutorial we could define 
 * this beautiful chaining functions like `getResourceFrom` that were quite handy:
 */
const oldGetResourceFrom = (type) => (id) => 
    m.of(suffix(type, id))
    .tellMap((url) => `Retrieving ${url}... `) 
    .cont(mGetResource)
/*
 * Now, because `getResourceFrom` uses `mGetResource` it would also have to accept a 
 * datasource when called, and our whole codebase will become bloated. Unless there is a transformation 
 * that can handle this for us. 
 *
 * And as you might suspect, there actually is one.   
 *
 * The `Reader` monad transformation is the evil twin of the `Writer` monad transformation.
 * It gives us access to a immutable datastructure sometimes called an 'environment' for storing all kinds of configurations
 * throughout our computation without bothering to pass it around to each new function.
 * It is like an additional parameter that you cannot change.
 *
 * In order to use the `Reader` monad transformer let's first refactor our code a bit:
 */

const oldGetResourceFrom2 = (type) => (id) => 
  m.of(suffix(type, id))
    .chain((url) => m.fromContinuation(mGetResource(url)))
/*
 * Remember this? This is the first version of the `getResourceFrom` function which does not use the `cont` helper.
 * Or it is close to it anyways - this one uses another helper - the `fromContinuation` constructor. We desugared our 
 * function in order to combine it with another helper - `loadEnvironment`.
 */

const mGetResourceFrom = (type, id) => 
  m.loadEnvironment().chain((environment) =>
    m.fromContinuation(mGetResource(suffix(type, id), environment)))

/*
 * So that is the formula for using the `Reader`: we define the environment in the `run` method, 
 * we use the environment whenever we need it in the function body, and all functions that we call with
 * `chain` also have access to the environment.
 *
 * The `Reader` allows us to run our function against the data that we defined earlier or any other.
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
 * That is all good, you might say, but why did we have to take a step back in order to use it? Why can't we still use the
 * `cont` helper _and_ have access to the environment?
 * The reason for this is that we are combining the effects of two different monad transformers. 
 * And although it may seem so from a first glance, monad transformers aren't in any way related to each other. 
 * A monad transformer stack is defined just by specifying the transformers that it uses and in which order.
 * For example here is a monad transformer stack that we can use for this tutorial:
 */

const m = mtl.make(mtl.base.task, mtl.data.maybe, mtl.data.writer, mtl.comp.reader)

/*
 * We include just the monads we need and we can customize the stack however we like.
 * If you really want to use a given helper it is not hard to define it in terms of the other helpers.
 * Here is, for example, a function for chaining computations that use the environment (remember: `chain` 
 * and `of` are key, everything else can be defined in terms of them).
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
 * As you can see it works in the same way as it worked before. the only difference is that we have to pass the
 * environment as an argument to the `run` function.
 *
 * ## Posting resources
 * 
 * How would a primitive function for posting resources looks like? Here is one way:
 */
const postResourceTo = (type, id) => (resource) => m.loadEnvironment().chain((data) =>
  m.fromContinuation(data.postResource.bind(null, suffix(type, id), resource))) 
/* 
 * It is pretty easy to conceive once you understand its `get` counterpart.
 *
 * ### Interlude: Currying
 *
 * Wait a sec. Do we need a function that receives a resource type and an id, and returns a resource modifier?
 * Or do we actually want one that receives just the type and returns a function that accepts both an ID and a new version of a
 * resource? If you find yourself asking these questions, the answer is just to wrap the function in the `curry` constructor
 * and make it work both ways.
 *
 * Just remember to order your arguments from the one you know a lot about to the one that you don't know:
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
   m.of('john')
    .chain(mMakeFarmer)
    .run((result) => {
      test.deepEqual(result.taskSuccess.value.value,{name:"John", occupation:"farmer"})
      test.done()
    }, {environment:initData()})
}
/*
 * To be sure, let's retrieve the resource again, after changing it:
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
 * This may seem weird, since we never do it with Promises for example, but here it makes sense.
 * There even is a shortcut method for this - `andThen`.
 */

/*
 * ## Parametrizing the monad stack
 *
 * Now we can use our functions with any datasource that supports the same API, however we still
 * are bound to the implementation of the monad stack. That is, we will have to refactor them 
 * every time we want to use them with a different stack. To fix this, we have to parametrize
 * them further - add the `m` value as an argument. With this we are done and we can export them
 * for the next part of the tutorial:
 */
exports.initData = initData

exports.mGetResourceFrom = mtl.curry((type, id, m) => 
  m.loadEnvironment().chain((environment) =>
    m.fromContinuation(mGetResource(suffix(type, id), environment))))

exports.mPostResourceTo = mtl.curry((type, id, resource, m) => m.loadEnvironment().chain((data) =>
  m.fromContinuation(data.postResource.bind(null, suffix(type, id), resource))))

/*
 * Go to [Part 3](p3.md)
 */
