/**
 * invocation: e.g. `DEBUG=true TESTS='\(\(\)\)<p>\(\(\)\).' ./node_modules/.bin/jest __tests__/TurtleParser-test.js`
 */

const {TurtleParser} = require('../lib/TurtleParser');
const {origText} = require('../lib/TurtleJisonContext');
const {DataFactory} = require('rdf-data-factory');

DEBUG = process.env.DEBUG;
TESTS = process.env.TESTS;

const baseIRI = 'http://localhost/some/path.ext'
const factory = new DataFactory();
const parser = new TurtleParser({baseIRI, factory})

describe('TurtleParser', () => {
  for (const test of getTests()) {
    if (!TESTS || test.label === TESTS || test.label.match(new RegExp(TESTS))) {
      it(`should parse ${test.label}`, () => {
        const [parseTree, quads] = parser.parse(test.in, test.base, test.prefixes);
        if (DEBUG) {
          console.log("parseTree:", JSON.stringify(parseTree, null, 2));
          console.log("quads:", quads);
        }
        const rendered = origText(parseTree).join('');
        expect(rendered).toEqual(test.in);
        if (test.parseTree) { // console.log(JSON.stringify(parseTree))
          expect(parseTree).toEqual(test.parseTree);
        }
      });
    }
  }
});

function getTests () { return [
  { label: "empty", in: ``, parseTree: {statementList: []} },
  { label: "prefix", in: `
PREFIX/*a*/pre:/*b*/<http://a.example/ns#>/*c*/`, parseTree:
    {"statementList":[
      {"type":"ws","origText":"\n"},
      {"type":"sparqlPrefix","keyword":{"type":"KEYWORD","origText":"PREFIX"},
       "ws1":[{"type":"comment","origText":"/*a*/"}],
       "prefix":{"type":"prefix","value":"pre","origText":"pre:"},
       "ws2":[{"type":"comment","origText":"/*b*/"}],
       "namespace":{"type":"relativeUrl","value":"http://a.example/ns#","origText":"<http://a.example/ns#>","term":{"termType":"NamedNode","value":"http://a.example/ns#"}}
      },
      {"type":"comment","origText":"/*c*/"}
    ]} },
  { label: "spo", in: `<#s><#p><#o>.`, base: 'http://a.example/ns', parseTree:
    {"statementList":[
      {"type":"subject_predicateObjectList",
       "subject":{
         "type":"relativeUrl","value":"http://a.example/ns#s","origText":"<#s>",
         "term":{"termType":"NamedNode","value":"http://a.example/ns#s"}
       },"ws1":[],"predicateObjectList":[
         {"type":"verb_objectList",
          "verb":{
            "type":"relativeUrl","value":"http://a.example/ns#p","origText":"<#p>",
            "term":{"termType":"NamedNode","value":"http://a.example/ns#p"}},
          "ws1":[],"objectList":[
            {"type":"relativeUrl","value":"http://a.example/ns#o","origText":"<#o>",
             "term":{"termType":"NamedNode","value":"http://a.example/ns#o"}}
          ]}
       ]},
      {"type":"token","origText":"."}
    ]} },
  { label: "spoo", in: `<#s><#p><#o1>,<#o2>.`, base: 'http://a.example/ns', parseTree:
    {"statementList":[
      {"type":"subject_predicateObjectList",
       "subject":{
         "type":"relativeUrl","value":"http://a.example/ns#s","origText":"<#s>",
         "term":{"termType":"NamedNode","value":"http://a.example/ns#s"}
       },"ws1":[],"predicateObjectList":[
         {"type":"verb_objectList","verb":{
           "type":"relativeUrl","value":"http://a.example/ns#p","origText":"<#p>",
           "term":{"termType":"NamedNode","value":"http://a.example/ns#p"}},
          "ws1":[],"objectList":[
            {"type":"relativeUrl","value":"http://a.example/ns#o1","origText":"<#o1>",
              "term":{"termType":"NamedNode","value":"http://a.example/ns#o1"}},
            {"type":"token","origText":","},
            {"type":"relativeUrl","value":"http://a.example/ns#o2","origText":"<#o2>",
             "term":{"termType":"NamedNode","value":"http://a.example/ns#o2"}}
          ]}
       ]},{"type":"token","origText":"."}
    ]} },
  { label: "spopo", in: `<#s><#p1><#o1>;<#p2><#o2>.`, base: 'http://a.example/ns', parseTree:
    {"statementList":[
      {"type":"subject_predicateObjectList",
       "subject":{
         "type":"relativeUrl","value":"http://a.example/ns#s","origText":"<#s>",
         "term":{"termType":"NamedNode","value":"http://a.example/ns#s"}
       },"ws1":[],"predicateObjectList":[
         {"type":"verb_objectList",
          "verb":{
            "type":"relativeUrl","value":"http://a.example/ns#p1","origText":"<#p1>",
            "term":{"termType":"NamedNode","value":"http://a.example/ns#p1"}},
          "ws1":[],"objectList":[
            {"type":"relativeUrl","value":"http://a.example/ns#o1","origText":"<#o1>",
             "term":{"termType":"NamedNode","value":"http://a.example/ns#o1"}}
          ]},
         {"type":"token","origText":";"},
         {"type":"verb_objectList",
          "verb":{
            "type":"relativeUrl","value":"http://a.example/ns#p2","origText":"<#p2>",
            "term":{"termType":"NamedNode","value":"http://a.example/ns#p2"}},
          "ws1":[],"objectList":[
            {"type":"relativeUrl","value":"http://a.example/ns#o2","origText":"<#o2>",
             "term":{"termType":"NamedNode","value":"http://a.example/ns#o2"}}
          ]}
       ]},
      {"type":"token","origText":"."}
    ]} },
  { label: "()<p>().", in: `()<p>().`, parseTree: {
    "statementList": [
      { "type": "collection_predicateObjectList",
        "collection": [
          { "type": "collection",
            "startToken": { "type": "startCollection", "origText": "(" },
            "elts": [],
            "ws1": [],
            "endToken": { "type": "endCollection", "origText": ")" },
            "term": { "termType": "NamedNode", "value": "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil" } }
        ],
        "ws1": [],
        "predicateObjectList": [
          { "type": "verb_objectList",
            "verb": {
              "type": "relativeUrl",
              "value": "http://localhost/some/p",
              "origText": "<p>",
              "term": { "termType": "NamedNode", "value": "http://localhost/some/p" }
            },
            "ws1": [],
            "objectList": [
              { "type": "collection",
                "startToken": { "type": "startCollection", "origText": "(" },
                "elts": [],
                "ws1": [],
                "endToken": { "type": "endCollection", "origText": ")" },
                "term": { "termType": "NamedNode", "value": "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil" } }
            ] }
        ] },
      { "type": "token", "origText": "." }
    ]
  } },
  { label: "(())<p>(()).", in: `(())<p>(()).`, parseTree: {
  "statementList": [
    { "type": "collection_predicateObjectList", "collection": [
        { "type": "collection", "startToken": { "type": "startCollection", "origText": "(" },
          "elts": [
            { "ws0": [],
              "node": {
                "type": "collection",
                "startToken": { "type": "startCollection", "origText": "(" },
                "elts": [], "ws1": [], "endToken": { "type": "endCollection", "origText": ")" },
                "term": { "termType": "NamedNode", "value": "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil" } },
              "elts": [], "ord": 0,
              "li": { "termType": "BlankNode", "value": "df_0_0" } }
          ],
          "ws1": [], "endToken": { "type": "endCollection", "origText": ")" } }
      ],
      "ws1": [],
      "predicateObjectList": [
        { "type": "verb_objectList",
          "verb": {
            "type": "relativeUrl", "value": "http://localhost/some/p", "origText": "<p>",
            "term": { "termType": "NamedNode", "value": "http://localhost/some/p" } },
          "ws1": [],
          "objectList": [
            { "type": "collection",
              "startToken": { "type": "startCollection", "origText": "(" },
              "elts": [
                { "ws0": [],
                  "node": {
                    "type": "collection", "startToken": { "type": "startCollection", "origText": "(" },
                    "elts": [],
                    "ws1": [], "endToken": { "type": "endCollection", "origText": ")" },
                    "term": { "termType": "NamedNode", "value": "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil" } },
                  "elts": [], "ord": 1,
                  "li": { "termType": "BlankNode", "value": "df_0_1" } }
              ],
              "ws1": [],
              "endToken": { "type": "endCollection", "origText": ")" } }
          ] }
      ] },
    { "type": "token", "origText": "." }
  ]
  } },
  { label: "kitchen sink spaces", in: `
PREFIX pre: <http://a.example/ns#> 

 <url1> a pre:Class1 , pre:Class2 ; #here
  pre:p1 "cd" , "ef"@en , "gh"^^<ji> , _:xy ;
  pre:p2 <//b.example/u3> .

 ( 111 ( 222 333 ) 444  [ pre:p3 [ pre:p4 'p4' ] ; pre:p5 555 ] ) 
  pre:p6 () .
 [ <a> 1, [ <b> 2 ] ].
 [ # mid-anon
 ] <b> [ # mid-anon
 ] .
# [] <c> 3 , "chat" ^^ pre:dt .
# [ <c> 3 , "chat" ^^ pre:dt, [ <d> 4 ] , "chat" @en ] . 
` },
  { label: "kitchen sink comments", in: `
PREFIX/*a*/pre:/*b*/<http://a.example/ns#>/*c*/

/*a*/<url1>/*b*/a/*c*/pre:Class1/*d*/,/*e*/pre:Class2/*f*/; #here
  pre:p1 "cd" , _:xy ;
  pre:p2 <//b.example/u3> .

/*a*/(/*b*/111/*c*/(/*d*/222/*e*/333/*f*/)/*g*/444/*h*/[/*i*/pre:p3/*j*/[/*k*/pre:p4/*k*/'p4'/*m*/]/*n*/;/*o*/pre:p5/*p*/555/*q*/]/*r*/)/*i*/
  pre:p6 () .
 [ <a> 1 ] <b> 2 . # [ <c> 3 , "chat" ^^ pre:dt, [ <d> 4 ] , "chat" @en ] . 
` },
]; }
