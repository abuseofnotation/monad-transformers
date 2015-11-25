
exports.idWrapped = {
  name: 'idWrapped',
  of (val) { 
    return {idContainer:this.outer.of({idVal: val })}
  },
  chain (funk, id) {
    return {
      idContainer:this.outer.chain((innerId) => {
        const val = funk(innerId.idVal)
        return val.idContainer
      }, id.idContainer)
    }
  },
  lift (val) {
    return {idContainer:this.outer.chain((innerValue) => this.outer.of({idVal: innerValue}), val)}
  },
  run (funk, val) {
    return this.outer.run((innerId)=> {
      return funk(innerId.idVal)
    }, val.idContainer)
  }
}
exports.id = {
  name: 'Id',
  of (val) { 
    return this.outer.of({idVal: val }) 
  },
  chain (funk, val) {
    return this.outer.chain((innerId) => {
      return funk(innerId.idVal)
    }, val)
  },
  lift (val) {
    return this.outer.chain((innerValue) => this.outer.of({idVal: innerValue}), val)
  },
  run (funk, val) {
    return this.outer.run((innerId)=> {
      return funk(innerId.idVal)
    }, val)
  }
}

