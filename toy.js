const {TurtleParser} = require('./lib/TurtleParser');
const {DataFactory} = require('rdf-data-factory');

const baseIRI = 'http://localhost/some/path.ext'
const factory = new DataFactory();
const parser = new TurtleParser({baseIRI, factory})

console.log('--------------------');
const [locations, quads] = parser.parse(`
PREFIX pre: <http://a.example/ns#>

/*a*/(/*b*/111/*c*/(/*d*/222/*d*/333/*e*/)/*f*/444/*g*/)/*h*/# [ pre:p3 [ pre:p4 'p4' ] ; pre:p5 555 ] 
  pre:p6 () .
# [ <a> 1 ] <b> 2 . # [ <c> 3 , "chat" ^^ pre:dt, [ <d> 4 ] , "chat" @en ] . 

#<url1> a pre:Class1 , pre:Class2 ; #here
#  pre:p1 "cd" , _:xy ;
#  pre:p2 <//b.example/u3> .
# ( 111 ( 222 333 ) 444 [ pre:p3 [ pre:p4 'p4' ] ; pre:p5 555 ] ) 
#  pre:p6 666 .
`);
console.log('--------------------');
console.log(JSON.stringify(quads, null, 2));
console.log(origText(locations).join(''));
console.log(JSON.stringify(locations, null, 2));

function origText (obj) {
  return Object.keys(obj).reduce((acc, key) =>
    key === 'origText'                  // extract origText
      ? acc.concat([obj[key]])
      : typeof obj[key] === 'object'    // recurse nested objects
      ? acc.concat(origText(obj[key]))
      : acc                             // ignore other values
    , [])
}

