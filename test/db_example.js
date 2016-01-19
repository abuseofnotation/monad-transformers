/* # Database Example
 *
 * The following examples show performing async database operations using the mtl library.
 *
 * We will be mocking a simple simple REST API with a set of resources defined in the `data`
 * object and a function that simulates retriving a resource asynchronously - `getResource`. 
 * 
 * Our task will be related to retrieving info about the users and their occupations and handling different kinds
 * of errors.
 */
const mtl = require('../lib/main')
if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}
const initData = () => {
  const data = {
    'users/john': {
      name:'John',
      occupation: 'developer'
    },
    'users/max': {
      name: 'Max' //Has no occupation
    },
    'users/jim': {
      name:'Jim',
      occupation: 'farmer'
    },
    'occupations/developer': {
      description: 'writes code'
    },
    'occupations/farmer': {
      description: 'feeds the animals'
    }
  }
  return {
    getResource (url, error, success) {
      setTimeout(() => data[url]!== undefined ? success(data[url]) : error({error:`Invalid URL - ${url}`}), 10)
    },
    postResource (url, value, error, success) {
      setTimeout(() => { data[url] = value; success(value) }, 10)
    }
  }
}
/* ## Defining some helpers
 * 
 * Before we start, let's define several helpers that we will use.
 */

const data = initData()
const mGetResource = (url) => data.getResource.bind(null, url)

const suffix = mtl.curry((suffix, str) => suffix + '/' + str)

/*
 * - `mGetResource` is just a curried version of the function that we defined in the mock. 
 *
 * - `suffix` is a function for concatenating strings, which we can use to construct a URL of a given resource.
 * We are defining it using `curry` which means that calling it with just one argument will return a new function
 * that 
 *
 * ### Composing functions with mtl
 *
 * Now after looking at these two helpers, it is not such a long shot to imagine combining them to get a function 
 * that retrieves a resource given its ID. 
 *
 * One way to do this is by using simple function composition:
 */

const compose = (f, g) => (a) => g(f(a))
const ordinaryGetResourceFrom = compose(suffix, mGetResource)


/* This was cool, however the `ordinaryGetResourceFrom` function itself cannot be composed via simple function 
 * composition any more, simply because it is asynchronous. 
 *
 * However it *can* be composed in principle, and we do that quite often in Javascript. You know, using Promises.
 * By passing the async functions to the `then` method.
 *
 * mtl supports Promises too - more precisely their immutable conterparts - Tasks. So we can wrap our normal 
 * callback-based async function into a task and just return it, using `chain` (which is kinda like `then` for 
 * Promises).
 */

const Task = require('data.task')

const taskGetResourceFrom = (type) => 
  (id) => 
    m.of(suffix(type, id))
    .chain((url) => m.fromTask(new Task(mGetResource(url))))
/*
 * This works, but there is a slightly prettier way to write it using the `cont` function, which creates the
 * task behind the scenes.
 */
const getResourceFrom = (type) => (id) => 
    m.of(suffix(type, id))
    .tellMap((url) => `Retrieving ${url}... `) 
    .cont(mGetResource)
/*
 * You noticed that we added one more line? That is cool but it is irrelevant for now.
 *
 * I would like to make several remarks, on this version of the function:
 *
 * - It is written in such a way that we expect the `mResourceId` parameter to already be wrapped in a monad. 
 * In that way we can define (and configure) our monad globally and not deal with it every time.
 *
 * - You also don't have to know about the async lib that is being used - you just use the `cont` helper.
 *
 * - We haven't lost the ability to do normal function composition. We can do this by using the `map` 
 * function, provided by mtl. Functions, composed with `map` don't have to know about monads and wrappers at all.
 *
 * ### Using mtl helpers
 *
 * We will define one more helper function before we begin. One that given a person object, retrieves info about
 * its occupation.
 * The function is simple - just retrieve the `occupation` key from the person object and then make a request for
 * it from the `occupations` endpoint (see the data model above).
 *
 * Again, we can write this function in an mtl context. This is a fancy way of saying that it will accept and return
 * a wrapped value.
 *
 * Besides modes of composition, mtl gives you all kinds of helper functions that you can use. In this case we 
 * receive a plain JS object an want to access one of its properties. There is a function that 
 * does that in the Maybe monad transformer called `maybeGet`. `maybeGet` also handles the case when the value of 
 * the requested property is not defined.
 */

const getOccupationInfo = (mPersonalInfo) =>
  m.of(mPersonalInfo)
    .maybeGet('occupation')
    .chain(getResourceFrom('occupations'))

/* Notice also how we compose mtl functions by using `chain`.
 *
 * ## Writing our program
 *
 * Now at this point some of you might feel the desire to urge me to "stop theorizing" and "write some real code" 
 * that "actually does something". I am OK, with that. 
 * For example, let's write a snippet that first retrieves the details for a given user then retrieve the details of his
 * occupation and finally displays both pieces of info one after the other. Do you want to do that?
 *
 */

const m = mtl.advanced 

const getPersonInfo = (name) =>
  m.of(name) //1
    .chain(getResourceFrom('users')) //2
    .chain((personDetails) => //3
      getOccupationInfo(personDetails) //4
        .map((occupationInfo) => `${personDetails.name} ${occupationInfo.description}` )) //5
/*
 * There should be nothing new for you in this snippet. Let`s review it line by line, as a summary of this
 * tutorial:
 *
 * 1. We begin by puttin a regular value into a monad, using the `of` function.
 *
 * 2. With `chain` we compose a function that receives a normal value and returns a monadic value.
 * `chain` is actually the quintessential monadic function, so there is a lot of info available
 * about it.
 *
 * 3. We `chain` again, this time with an inline function.
 *
 * 4. When we are calling `chain` we have to return a monadic value, and we do that.
 * Again when you have a function that works in a monadic context, and you want to use it with 
 * a "normal" value, you just wrap the value in a monad before feeding it to the function.
 *
 * 5. We transform the value before returning it, using a "plain", non-monadic function, and the way
 * to compose plain functions which aren't meant to be used inside a monad is by using `map`
 * in the same way as `Array.map` is used to apply functions which don't work on arrays by 
 * themselves, to Arrays. 
 *
 * Using `map` inside the `chain` lambda is equivalent to using it outside of it. We do it inside
 * just because we want to be able to use the `personalDetails` object.
 *
 * ## What we did
 *
 * Now we will test the `getPersonInfo` function and make sure that it works well. The function returns 
 * a monad which contains our value, so we will want to take the value out of the monad. We do this by using 
 * the `run` function which accepts a normal callback:
 */

exports.dbSuccess = (test) =>
  getPersonInfo('john')
    .run((result) => {
      test.equal(result.taskSuccess.maybeVal[0][0], 'John writes code')
      test.done()
    }) 
/* 
 * This works fine but I better explain the `taskSuccess.maybeVal[0][0]` part.
 *
 * Each monad transformation which we use (or don't) defines its own object namespace. In that namespace
 * we can see its value, which is actually the namespace of another monad. So effectively this means that 
 * in order to get to our value, we have to go through all these namespaces.
 * Why not just return the value directly? 
 * Because, as you will find out shortly, each layer of the monadic onion contributes something to 
 * our program:
 * 
 * ### Handling errors
 *
 * If we try to retrieve information abot a person that does not exist the Task monad will handle the error
 * by stopping the computation. You will find the error in the `taskError` property:
 */

exports.dbError = (test) =>
  getPersonInfo('UndefinedPerson')
    .run((result) => {
      test.equal(result.taskError.error, 'Invalid URL - users/UndefinedPerson') 
      test.done()
    }) 


/* 
 * ### Handling undefined properties
 * 
 * The Maybe monad transformer handles undefined values in much the same way as the Task handles errors -
 * it stops everything. In that way we can retrieve values that are undefined, and not get any errors for
 * trying to do something with them afterwards. We have to do a null check only once - at the end.
 *
 * For example here is what happens if we try to request a user that does not have an "occupation" field.
 *
 */
exports.dbMaybe = (test) =>
  getPersonInfo('max')
    .run((result) => {
      test.equal(result.taskSuccess.maybeVal, undefined)
      test.done()
    }) 


/* ### Logging
 *
 * Remember that our `getResourceFrom` function had one line which we ignored:
 *
 * `.tellMap((url) => 'Retrieving ${url}')`
 *
 * this line actually logs the url being requested by using the Writer monad.
 *
 * Sure enough, the log is part of the end result:
 */
exports.dbLog = (test) =>
  getPersonInfo('john')
    .run((result) => {
      test.equal(result.taskSuccess.maybeVal[1], 'Retrieving users/john... Retrieving occupations/developer... ')
      test.done()
    }) 

/*
 * ## More Writer
 *
 * Logging is not the only use of the Writer monad. As a matter of fact, we can store
 * our whole result in the Writer value. 
 * This would free us from the burden of having to build the result explicitly.
 *
 * The following shows a new version of our program that uses the Writer monad to retrieve results about two people.
 */

const wGetResourceFrom = (type) => 
  (mResourceId) => mResourceId
    .map(suffix(type))
    .cont(mGetResource)

const wGetOccupationInfo = (mPersonalInfo) =>
  mPersonalInfo.maybeGet('occupation')
    .tap(wGetResourceFrom('occupations'))

const writePersonInfo = (name) =>
  m.of(name)
    .map(suffix('users'))
    .cont(mGetResource)
    .tellMap((userInfo) => userInfo.name)
    .tell(" ")
    .tap(wGetOccupationInfo)
    .tellMap((occupationInfo => occupationInfo.description))

exports.dbWriter = (test) =>
  writePersonInfo('john')
    .tell(", ")
    .kleisi(writePersonInfo('jim'))
    .run((result) => {
      test.equal(result.taskSuccess.maybeVal[1], 'John writes code, Jim feeds the animals')
      test.done()
    }) 

