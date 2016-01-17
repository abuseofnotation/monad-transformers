var sources = 'lib/*.js'

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'), // the package file to use
    concat: {
	basic_and_extras: {
  	  options:{
	    process:function(src){
	    return src
              .replace(/\r/gm, '')
              .split(/\n/)
              .map((row) => {
                var twoL = row.slice(0,2)
                if(twoL === '/*' || twoL === ' *' || twoL === '*/') {
                  return row.length > 3 ? row.slice(3) + ' ' : '\n\n'
                } else {
                  return '    ' + row + '\n'
                }
              })
              .join('')
              
	    }
	  },
          files: {
            'docs/overview.md': ['lib/main.js'],
            'docs/wrapper.md': ['lib/wrapper.js'],
            'docs/implementing-transformer.md': ['lib/id.js'],
            'docs/api.md': ['lib/data.js', 'lib/comp.js'],
            'docs/example.md': ['test/db_example.js']
          },
       }
    },
    standard: {
      options: {
        // Task-specific options go here. 
      },
      your_target: [sources, "test/*.js"]
    }
  })

  grunt.loadNpmTasks('grunt-standard')
  grunt.loadNpmTasks('grunt-contrib-concat')
}
