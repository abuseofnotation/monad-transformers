/*
Generic Grunt file.

Works with the following project structure.
/lib  - Your source files. Can be configured via the 'sources' variable.
/test  - Should contain a QUnit test suite. The tests are run against a web server (port configurable).
/target - Folder created by the build which contains:
 - <yourmodule>.js - Compiled source (file name taken from package.json).
 - <yourmodule>.map - Source map for your module.
 - <yourmodule>.min.js - Minified source.
 
 
  "devDependencies": {
    "browserify-versionify": "^1.0.4",
    "grunt": "^0.4.5",
    "grunt-browserify": "^3.3.0",
    "grunt-contrib-nodeunit": "^0.5.2",
    "grunt-contrib-watch": "^0.6.1",
    "grunt-exorcise": "^1.0.0",
    "phantomjs": "^1.9.12",
    "qunitjs": "^1.15.0",
    "uglifyify": "^3.0.1"
  }
 
*/

var sources = 'lib/*.js'

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'), // the package file to use
    // Runs Q-Unit tests
    nodeunit: {
      all: ['test/*.js'],

    },
    // Runs a task whenever some of the source files change
    watch: {
      files: ['test/*.js', sources],
      tasks: ['test']
    },
    exorcise: {
      bundle: {
        options: {},
        files: {
          'target/<%= pkg.name %>.min.map': ['target/<%= pkg.name %>.min.js'],
        }
      }
    },
    notify_hooks: {
      options: {
        enabled: true,
        max_jshint_notifications: 5, // maximum number of notifications from jshint output
        title: "Project Name", // defaults to the name in package.json, or will use project directory's name
        success: false, // whether successful grunt executions should be notified automatically
        duration: 3 // the duration of notification in seconds, for `notify-send only
      }
    },
    browserify: {
      beautiful: {
        options: {
          browserifyOptions: {
            debug: true
          },
          transform: ['babelify' , ['browserify-versionify', {global: true}]]
        },
        files: {
          'target/<%= pkg.name %>.js': [sources]
        }
      },
      ugly: {
        options: {
          browserifyOptions: {
            debug: true
          },
          transform: ['babelify' , ['browserify-versionify', {global: true}], ['uglifyify', {global: true}]]
        },
        files: {
          'target/<%= pkg.name %>.min.js': [sources]
        }
      }, 
      typescript: {
        base: {
          src: ['lib-ts/**/*.ts'],
          dest: 'lib-js',
          options: {
            module: 'commonjs', //or commonjs 
            target: 'es5', //or es3 
            basePath: 'lib-js',
            sourceMap: true,
            declaration: true
          }
        }
      },
      tests: {
        options: {
          browserifyOptions: {
            debug: true
          },
          transform: ['babelify' , ['browserify-versionify', {global: true}]]
        },
        files: {
          'test/tests_browser.js': ['test/tests.js']
        }
      },
    },
    standard: {
      options: {
        // Task-specific options go here. 
      },
      your_target: [sources, "tests/*.js"]
    }
  })


  // load up your plugins
  grunt.loadNpmTasks('grunt-contrib-watch')
  grunt.loadNpmTasks('grunt-contrib-nodeunit')
  grunt.loadNpmTasks('grunt-browserify')
  grunt.loadNpmTasks('grunt-exorcise')
  grunt.loadNpmTasks('grunt-standard')
  grunt.loadNpmTasks('grunt-notify')
  grunt.loadNpmTasks('grunt-typescript')

  grunt.registerTask('browser', ['browserify', 'exorcise'])
  grunt.registerTask('test', ['standard', 'nodeunit'])
  grunt.registerTask('default', ['browser', 'test'])
  
  grunt.task.run('notify_hooks')
}
