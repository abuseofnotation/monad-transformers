/* # Database Example
 *
 * The following examples show performing async database operations using the library.
 *
 * ## Making the Setup
 * 
 * For the sake of this example we will be mocking a simple REST API with a set of resources defined in the `data`
 * object and a function that simulates retriving a resource asynchronously - `getResource`. 
 * 
 * Our task will be related to  retrieving info about the users and their occupations and handling different kinds
 * of errors.
 */
if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}

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
const getResource = (url, error, success ) =>
    setTimeout(() => data[url]!== undefined ? success(data[url]) : error({error:`Invalid URL - ${url}`}), 10)

/* ## Defining some helpers
 * 
 * Before we start, let's require the library, and define several helpers that we will use.
 *
 * - `mGetResource` is just a curried version of the function that we defined in the demo. 
 * - `suffix` is a function for concatenating strings, which we can use to construct a URL of a given resource.
 */

const mGetResource = (url) => getResource.bind(null, url)

const suffix = (suffix) =>
  (str) => suffix + str

/* It is not such a long shot to imagine combining these two functions to get a function that retrieves a resource
 * given its ID. 
 *
 * We can do this either by using simple function composition:
 */

const compose = (f, g) => (a) => g(f(a))
const _getResourceFrom = compose(suffix, mGetResource)

/* The `_getResourceFrom` function cannot be composed via simple function composition, simply
 * because it is asynchronous. 
 *
 * However we can compose it with no issue with mtl- we simply use the `cont` function for composing continuations.
 * The cont function converts the continuation into a Task, object by using the Folktale library behind the scenes.
 * 
 * With this we haven't lost the ability to do normal function composition. We can do this by using the `map` 
 * function, provided by mtl. Here is a new version of `getResourceFrom` function that is equivalent to the
 * previous one, but it composes.
 */
const getResourceFrom = (type) => 
  (mResourceId) => mResourceId
    .map(suffix(type + '/'))
    .cont(mGetResource)
/* 
 * We will define one more helper function. One that given a user object, retrieves info about its occupation.
 * The function is simple - just retrieve the `occupation` key from the person object and then make a request for
 * it from the `occupations` endpoint (see above).
 *
 * And the function again presumes that we are using mtl. 
 *
 * Well if we do, than there is a function the Maybe monad transformer which we can use - the `maybeGet` method for
 * retrieving a property from an object. This means is that we can define our function simply by chaining.
 * Bonus - the method handles the cases when the value of the prop is not defined.
 */

const getOccupationInfo = (mPersonalInfo) =>
  mPersonalInfo.maybeGet('occupation')
    .tap(getResourceFrom('occupations'))

/* Notice also how we can compose monadic functions by using `tap`. `tap` is nothing hard - it just calls the 
 * specified function with the current value as an argument, just like in Underscore.JS.
 *
 */

const m = require('../lib/main').advanced

const getPersonInfo = (name) =>
  m.of(name)
    .tap(getResourceFrom('users'))
    .chain((personDetails) => 
      getOccupationInfo(m.of(personDetails))
        .map((occupationInfo) => `${personDetails.name} ${occupationInfo.description}` ))

exports.dbSimple = (test) =>
  getPersonInfo('john')
    .run((result) => {
      result().fork((err)=>{test.ok(false)}, (result)=>{
        debugger
        test.equal(result.maybeVal[0][0], 'John writes code')
        test.done()
      })
    }) 

exports.dbTask = (test) =>
  writePersonInfo('UndefinedPerson')
    .run((result) => 
      result().fork((err)=> {
        test.equal(err.error, 'Invalid URL - users/UndefinedPerson') 
        test.done()
      }, (success) => {test.ok(false)}))

/* ## The Maybe Monad
 */
exports.dbMaybe = (test) =>
  writePersonInfo('max')
    .run((result) => {
      result().fork((err)=>{test.ok(false)}, (result)=>{
        test.equal(result.maybeVal, undefined)
        test.done()
      })
    }) 


/* ## Writer Monad
 */
const writePersonInfo = (name) =>
  m.of(name)
    .map(suffix('users/'))
    .cont(mGetResource)
    .tellMap((userInfo) => userInfo.name)
    .tell(" ")
    .tap(getOccupationInfo)
    .tellMap((occupationInfo => occupationInfo.description))

exports.dbWriter = (test) =>
  writePersonInfo('john')
    .tell(", ")
    .kleisi(writePersonInfo('jim'))
    .run((result) => {
      result().fork((err)=>{test.ok(false)}, (result)=>{
        test.equal(result.maybeVal[1], 'John writes code, Jim feeds the animals')
        test.done()
      })
    }) 


