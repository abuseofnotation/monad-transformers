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
  run (funk, state) {
    return this.outer.run((params)=>{
      return funk(params[0])
    }, state())
  }
}
exports.list = {
  name: 'List',
  of (val) {
    return this.outer.of([val])
  },
  chain (funk, val) {
    return this.outer.chain(innerVal => {
      const a = innerVal.map(funk)
      return a.reduce((arr, i) => {
        return this.outer.chain(a=>arr.concat(a), i)
      },[])
    }, val)
  },
  lift (val) {
    return this.outer.chain(innerValue => this.outer.of([innerValue]), val)  
  },
  run (funk, val){
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
  }
}
