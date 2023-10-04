const {TurtleParser} = require('./lib/TurtleParser');
const {origText} = require('./lib/TurtleJisonContext');
const {DataFactory} = require('rdf-data-factory');

const baseIRI = 'http://localhost/some/path.ext'
const factory = new DataFactory();
const parser = new TurtleParser({baseIRI, factory})

console.log('--------------------');
const [locations, quads] = parser.parse(``);
console.log('--------------------');
console.log(JSON.stringify(quads, null, 2));
console.log(origText(locations).join(''));
console.log(JSON.stringify(locations, null, 2));
