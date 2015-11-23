exports.state = {
  name: 'State',
  of (val) {
    return (prevState) => this.outer.of([val, prevState])
  },
  chain (funk, val) {
    return (prevState) =>
      this.outer.chain((params) => {
        const newVal = params[0], newState = params[1]
        return funk(newVal)(newState)
      }, val(prevState))
  },
  lift (val) {
    return (prevState) =>
      this.outer.chain((innerValue) => this.outer.of([innerValue, prevState]), val)
  },
  load (val) {
    return (prevState) => this.outer.of([prevState, prevState])
  },
  save (val) {
    return (prevState) => this.outer.of([val, val])
  },
  mapState (funk, val){
    return (prevState) => this.outer.of(funk(val, prevState))
  },
  run (funk, state) {
    return this.outer.run((params)=>{
      return funk(params[0])
    }, state())
  }
}

exports.stream = {
  name: 'Stream',
  of (val) {
    return (add) => { 
      add(this.outer.of(val)) 
    }
  },
  chain (funk, val) {
    return (add) => { 
      val((value)=> {
        this.outer.chain((v) => {
          funk(v)(add)
        }, value)
      })
    }
  },
  run (funk, val) {
    val(value =>{
      this.outer.run(a => a, value) 
    })
  },
  filter (funk, val) {
    return (add) => {
      val(val => {
        if(funk(val)) {
          add(val)
        }
      })
    }
  },
  fromPublisher (externalPublisher) {
    return (add) => {
      externalPublisher((val) => {
        add(this.outer.of(val)) 
      })
    }
  }
}
exports.list = {
  name: 'List',
  of (val) {
    return this.outer.of([val])
  },
  chain (funk, val) {
    //TODO - reduce this to something more readable
    return this.outer.chain(innerVal => {
      return  innerVal.reduce((accumulatedVal, newVal) => {
        return this.outer.chain(accumulated=> {
          return this.outer.chain(_new => this.outer.of(accumulated.concat(_new)), funk(newVal))
        }, accumulatedVal)
      }, this.outer.of([]))
    }, val)
  },
  lift (val) {
    return this.outer.chain(innerValue => this.outer.of([innerValue]), val)  
  },
  run (funk, val) {
    return this.outer.run((list)=>{
      return list.map(funk)
    }, val)
  },
  filter (funk, val) {
    if (funk(val)) {
      return this.of(val)
    } else {
      return this.outer.of([])
    }
  },
  fromArray (val) {
    if(val.concat && val.map && val.reduce && val.slice){
      return this.outer.of(val)
    } else{
      throw val+" is not a list."
    }
  }
}
