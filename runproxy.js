console.log('run with arguments:');
console.log(process.argv.slice(2));

require('./pacproxy.js').run()