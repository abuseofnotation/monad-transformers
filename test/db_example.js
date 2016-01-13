
if ( global.v8debug ) {
	global.v8debug.Debug.setBreakOnException()
}

const mtl = require('../lib/main')

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
const suffix = (suffix) =>
  (str) => suffix + str

const retrieve = (url) => 
  (reject, resolve) => {
    setTimeout(() => data[url]!== undefined ? resolve(data[url]) : reject({error:`Invalid URL - ${url}`}), 10)
  }

const getOccupationInfo = (personInfo) =>
  mtl.advanced.of(personInfo)
    .get('occupation')
    .map(suffix('occupations/'))
    .cont(retrieve)

const getPersonInfo = (name) =>
  mtl.advanced.of(name)
    .map(suffix('users/'))
    .cont(retrieve)
    .chain((personDetails) => 
      mtl.advanced.of(personDetails)
        .chain(getOccupationInfo)
        .map((occupationInfo) => `${personDetails.name} ${occupationInfo.description}` ))
    

exports.dbSimple = (test) =>
  getPersonInfo('john')
    .run((result) => {
      result().fork((err)=>{test.ok(false)}, (result)=>{
        test.equal(result.maybeVal[0][0], 'John writes code')
        test.done()
      })
    }) 

exports.dbTaskError = (test) =>
  getPersonInfo('UndefinedPerson')
    .run((result) => 
      result().fork((err)=> {
        test.equal(err.error, 'Invalid URL - users/UndefinedPerson') 
        test.done()
      }, (success) => {test.ok(false)}))
/*
exports.dbUndefinedProperties = (test) =>
  getPersonInfo('max')
    .run((result) => {
      result().fork((err)=>{debugger;test.ok(false)}, (result)=>{
        test.equal(result.maybeVal,undefined)
        test.done()
      })
    }) 
*/


