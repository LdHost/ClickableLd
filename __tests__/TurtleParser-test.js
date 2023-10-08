/**
 * invocation: e.g. `DEBUG=true TESTS='\(\(\)\)<p>\(\(\)\).' ./node_modules/.bin/jest __tests__/TurtleParser-test.js`
 */

const {TurtleParser} = require('../lib/TurtleParser');
const {origText} = require('../lib/TurtleJisonContext');
const {DataFactory} = require('rdf-data-factory');

DEBUG = process.env.DEBUG;
TESTS = process.env.TESTS;

describe('TurtleParser', () => {
  describe('construction', () => {
    it('should construct with no params', () => {
      const parser = new TurtleParser();
      expect(parser.baseIRI).toBe(null);
      expect(parser.factory).toBeInstanceOf(DataFactory);
      const [parseTree, quads] = parser.parse('<a> <b> <c> .');
      expect(parseTree).toEqual({
        "statementList": [
          { "type": "subject_predicateObjectList",
            "subject": { "type": "relativeUrl", "value": "a", "origText": "<a>",
                         "term": { "termType": "NamedNode", "value": "a" } },
            "ws1": [ { "type": "ws", "origText": " " } ],
            "predicateObjectList": [
              {
                "type": "verb_objectList",
                "verb": { "type": "relativeUrl", "value": "b", "origText": "<b>",
                          "term": { "termType": "NamedNode", "value": "b" } },
                "ws1": [ { "type": "ws", "origText": " " } ],
                "objectList": [
                  { "type": "relativeUrl", "value": "c", "origText": "<c>",
                    "term": { "termType": "NamedNode", "value": "c" } },
                  { "type": "ws", "origText": " " }
                ] }
            ] },
          { "type": "token", "origText": "." }
        ]
      });
      expect(quads).toEqual([
        { "subject": { "termType": "NamedNode", "value": "a" },
          "predicate": { "termType": "NamedNode", "value": "b" },
          "object": { "termType": "NamedNode", "value": "c" } }
      ]);
    });

    it('should unescape', () => {
      const parser = new TurtleParser()
      expect(parser.baseIRI).toBe(null);
      expect(parser.factory).toBeInstanceOf(DataFactory);
      const abc = '<a\\u0062\\U00000063>';
      const ghi = '"g\\u0068\\U00000069"';
      const [parseTree, quads] = parser.parse(abc + ' <def> ' + ghi + ' .');
      const triple1 = parseTree.statementList[0];
      const s = triple1.subject;
      expect(s.value).toEqual("abc");
      expect(s.origText).toEqual('<a\\u0062\\U00000063>');
      const o = triple1.predicateObjectList[0].objectList[0];
      expect(o.String.value).toEqual("ghi");
      expect(o.String.origText).toEqual(ghi);
      expect(quads).toEqual([
        { "subject": { "termType": "NamedNode", "value": "abc" },
          "predicate": { "termType": "NamedNode", "value": "def" },
          "object": { "termType": "Literal", "value": "ghi", "language": "", "datatype": {
            "termType": "NamedNode",
            "value": "http://www.w3.org/2001/XMLSchema#string" } } }
      ]);
    });

    it('should abort informatively on unknown lexical term', () => {
      const parser = new TurtleParser()
      expect(parser.baseIRI).toBe(null);
      expect(parser.factory).toBeInstanceOf(DataFactory);
      try {
        const [parseTree, quads] = parser.parse('<a> <b> & .');
        throw Error('parse() should have thrown');
      } catch (e) {
        expect(e.hash.text).toEqual("&");
      }
    });

    it('should abort informatively on syntax error', () => {
      const parser = new TurtleParser()
      expect(parser.baseIRI).toBe(null);
      expect(parser.factory).toBeInstanceOf(DataFactory);
      try {
        const [parseTree, quads] = parser.parse('<a> <b> c .');
        throw Error('parse() should have thrown');
      } catch (e) {
        expect(e.hash.text).toEqual("c");
      }
    });

    it('should abort informatively on prefix error', () => {
      const parser = new TurtleParser()
      expect(parser.baseIRI).toBe(null);
      expect(parser.factory).toBeInstanceOf(DataFactory);
      try {
        const [parseTree, quads] = parser.parse('<a> <b> c:d .');
        throw Error('parse() should have thrown');
      } catch (e) {
        // console.log(e);
        expect(e.message).toEqual(`Parse error; unknown prefix "c:"
<a> <b> c:d .
--------^`);
        expect(e.hash.text).toEqual("c:d");
      }
    });

    it('should reset', () => {
      const parser = new TurtleParser()
      expect(parser.baseIRI).toBe(null);
      expect(parser.factory).toBeInstanceOf(DataFactory);
      const [parseTree0] = parser.parse(`PREFIX pre: <http://a.example/ns#>
pre:s<#p><#o>.`);
      expect(parseTree0.statementList[2].subject.value).toEqual("http://a.example/ns#s");
      const [parseTree1] = parser.parse('pre:s<#p><#o>.');
      expect(parseTree1.statementList[0].subject.value).toEqual("http://a.example/ns#s");
      parser.reset();
      expect(() => {
        parser.parse('pre:s<#p><#o>.')
      }).toThrow(`Parse error; unknown prefix "pre:"
pre:s<#p><#o>.
^`);
    });
  });

  describe('coverage', () => {
    const baseIRI = 'http://localhost/some/path.ext'
    const factory = new DataFactory();
    const parser = new TurtleParser({baseIRI, factory})

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
});

function getTests () { return [
  { label: "empty", in: ``, parseTree: {statementList: []} },
  { label: "prefix", in: `
PREFIX/*a*/pre:/*b*/<http://a.example/ns#>/*c*/pre:s<#p><#o>.`, parseTree:
    {"statementList":[
      {"type":"ws","origText":"\n"},
      {"type":"sparqlPrefix","keyword":{"type":"KEYWORD","origText":"PREFIX"},
       "ws1":[{"type":"comment","origText":"/*a*/"}],
       "prefix":{"type":"prefix","value":"pre","origText":"pre:"},
       "ws2":[{"type":"comment","origText":"/*b*/"}],
       "namespace":{
         "type":"relativeUrl","value":"http://a.example/ns#","origText":"<http://a.example/ns#>",
         "term":{"termType":"NamedNode","value":"http://a.example/ns#"}}
      },
      {"type":"comment","origText":"/*c*/"},
      {"type":"subject_predicateObjectList",
       "subject":{
         "type": "pname","value":"http://a.example/ns#s",
         "prefix": {"type": "prefix", "value": "pre", "origText": "pre:"},
         "localName": { "type": "localName", "value": "s", "origText": "s" }
       },"ws1":[],"predicateObjectList":[
         {"type":"verb_objectList",
          "verb":{
            "type":"relativeUrl","value":"http://localhost/some/path.ext#p","origText":"<#p>",
            "term":{"termType":"NamedNode","value":"http://localhost/some/path.ext#p"}},
          "ws1":[],"objectList":[
            {"type":"relativeUrl","value":"http://localhost/some/path.ext#o","origText":"<#o>",
             "term":{"termType":"NamedNode","value":"http://localhost/some/path.ext#o"}}
          ]}
       ]},
      {"type":"token","origText":"."},
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
        "subject": [
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
    { "type": "collection_predicateObjectList",
      "subject": [
        { "type": "collection", "startToken": { "type": "startCollection", "origText": "(" },
          "elts": [
            { "type": "collection",
              "startToken": { "type": "startCollection", "origText": "(" },
              "elts": [], "ws1": [], "endToken": { "type": "endCollection", "origText": ")" },
              "term": { "termType": "NamedNode", "value": "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil" } },
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
                { "type": "collection", "startToken": { "type": "startCollection", "origText": "(" },
                  "elts": [],
                  "ws1": [], "endToken": { "type": "endCollection", "origText": ")" },
                  "term": { "termType": "NamedNode", "value": "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil" } },
              ],
              "ws1": [],
              "endToken": { "type": "endCollection", "origText": ")" } }
          ] }
      ] },
    { "type": "token", "origText": "." }
  ]
  } },
  { label: "kitchen sink spaces", in: `
#Spellings of directives
@prefix  :   <http://turtle.example/#>    .    
PrEfIx  :  <http://sparql.example/#>  
@prefix pre: <http://turtle.example/pre#> .
pReFiX pre: <http://sparql.example/pre#> 
BaSe <http://sparql.example/base/>
@base <//turtle.example/base/> .

 <url1> a pre:Class1 , pre:Class2 ; #here
  pre:p1 "cd" , "ef"@en , "gh"^^<ji> , _:xy ;
  pre:p2 <//b.example/u3> .

(
) <a> (
) .

<s> <p> "a", 'b', """c
c"""@en-us, '''d
d''', -0, 1, 2.0, 3E+0, 4.5E-6, .7E1, true, false .

 ( 111 ( 222 333 ) 444  [ pre:p3 [ pre:p4 'p4' ] ; pre:p5 555 ] ) pre:p6 () .

 [ <a> 1, [ <b> 2 ; <c> [ <d> 3 ] ] ].

 [
 ] <b> [
 ] .

 [] <c> 3 , "chat" ^^ pre:dt .

 [ <c> 3 , "chat" ^^ pre:dt, [ <d> 4 ] , "chat"@en ] . 
` },
  { label: "kitchen sink comments", in: `
#Spellings of directives
@prefix/*0*//*1*/:/*2*//*3*//*4*/<http://turtle.example/#>/*5*//*6*//*7*//*8*/./*9*//*10*//*11*//*12*/
PrEfIx/*0*//*1*/:/*2*//*3*/<http://sparql.example/#>/*4*//*5*/
@prefix/*0*/pre:/*1*/<http://turtle.example/pre#>/*2*/.
pReFiX/*0*/pre:/*1*/<http://sparql.example/pre#>/*2*/
BaSe/*0*/<http://sparql.example/base/>
@base/*0*/<//turtle.example/base/>/*1*/.

/*0*/<url1>/*1*/a/*2*/pre:Class1/*3*/,/*4*/pre:Class2/*5*/;/*6*/#here
/*7*//*8*/pre:p1/*9*/"cd"/*10*/,/*11*/"ef"@en/*12*/,/*13*/"gh"^^<ji>/*14*/,/*15*/_:xy/*16*/;
/*17*//*18*/pre:p2/*19*/<//b.example/u3>/*20*/.

(
)/*0*/<a>/*1*/(
)/*2*/.

<s>/*0*/<p>/*1*/"a",/*2*/'b',/*3*/"""c
c"""@en-us,/*4*/'''d
d''',/*5*/-0,/*6*/1,/*7*/2.0,/*8*/3E+0,/*9*/4.5E-6,/*10*/.7E1,/*11*/true,/*12*/false/*13*/.

/*0*/(/*1*/111/*2*/(/*3*/222/*4*/333/*5*/)/*6*/444/*7*//*8*/[/*9*/pre:p3/*10*/[/*11*/pre:p4/*12*/'p4'/*13*/]/*14*/;/*15*/pre:p5/*16*/555/*17*/]/*18*/)/*19*/pre:p6/*20*/()/*21*/.

/*0*/[/*1*/<a>/*2*/1,/*3*/[/*4*/<b>/*5*/2/*6*/;/*7*/<c>/*8*/[/*9*/<d>/*10*/3/*11*/]/*12*/]/*13*/].

/*0*/[
/*1*/]/*2*/<b>/*3*/[
/*4*/]/*5*/.

/*0*/[]/*1*/<c>/*2*/3/*3*/,/*4*/"chat"/*5*/^^/*6*/pre:dt/*7*/.

/*0*/[/*1*/<c>/*2*/3/*3*/,/*4*/"chat"/*5*/^^/*6*/pre:dt,/*7*/[/*8*/<d>/*9*/4/*10*/]/*11*/,/*12*/"chat"@en/*13*/]/*14*/./*15*/
` },
]; }