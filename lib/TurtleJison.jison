/*
  jison Equivalent of accompanying bnf, developed in
  http://www.w3.org/2005/01/yacker/uploads/ShEx2

  Process:
    Started with yacker perl output.
    Made """{PNAME_LN} return 'PNAME_LN';""" lexer actions for refereneced terminals.
    Folded X_Opt back in to calling productions to eliminate conflicts.
      (X? didn't seem to accept null input during testing.)
    Stole as much as possible from sparql.jison
      https://github.com/RubenVerborgh/SPARQL.js
    including functions in the header. Some can be directly mapped to javascript
    functions:
      appendTo(A, B) === A.concat([B])
      unionAll(A, B) === A.concat(B)

  TODO:
    See if this will work as BNF ('*'s and '+'s...)
*/

%{
  /*
    ShEx parser in the Jison parser generator format.
  */

  const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      RDF_TYPE  = RDF + 'type',
      RDF_FIRST = RDF + 'first',
      RDF_REST  = RDF + 'rest',
      RDF_NIL   = RDF + 'nil',
      XSD = 'http://www.w3.org/2001/XMLSchema#',
      XSD_INTEGER  = XSD + 'integer',
      XSD_DECIMAL  = XSD + 'decimal',
      XSD_FLOAT   = XSD + 'float',
      XSD_DOUBLE   = XSD + 'double',
      XSD_BOOLEAN  = XSD + 'boolean',
      XSD_TRUE =  '"true"^^'  + XSD_BOOLEAN,
      XSD_FALSE = '"false"^^' + XSD_BOOLEAN,
      XSD_PATTERN        = XSD + 'pattern',
      XSD_MININCLUSIVE   = XSD + 'minInclusive',
      XSD_MINEXCLUSIVE   = XSD + 'minExclusive',
      XSD_MAXINCLUSIVE   = XSD + 'maxInclusive',
      XSD_MAXEXCLUSIVE   = XSD + 'maxExclusive',
      XSD_LENGTH         = XSD + 'length',
      XSD_MINLENGTH      = XSD + 'minLength',
      XSD_MAXLENGTH      = XSD + 'maxLength',
      XSD_TOTALDIGITS    = XSD + 'totalDigits',
      XSD_FRACTIONDIGITS = XSD + 'fractionDigits';

  const numericDatatypes = [
      XSD + "integer",
      XSD + "decimal",
      XSD + "float",
      XSD + "double",
      XSD + "string",
      XSD + "boolean",
      XSD + "dateTime",
      XSD + "nonPositiveInteger",
      XSD + "negativeInteger",
      XSD + "long",
      XSD + "int",
      XSD + "short",
      XSD + "byte",
      XSD + "nonNegativeInteger",
      XSD + "unsignedLong",
      XSD + "unsignedInt",
      XSD + "unsignedShort",
      XSD + "unsignedByte",
      XSD + "positiveInteger"
  ];

  const absoluteIRI = /^[a-z][a-z0-9+.-]*:/i;
%}

/* lexical grammar */
%lex

COMMENT                 '#' [^\u000a\u000d]* | "/*" ([^*] | '*' ([^/] | '\\/'))* "*/"
WS                      \s+
LANGTAG                 "@" [A-Za-z]+ ( "-" [0-9A-Za-z]+ )*
INTEGER                 [+-]? [0-9]+
DECIMAL                 [+-]? [0-9]* "." [0-9]+
EXPONENT                [Ee] [+-]?[0-9]+
DOUBLE                  [+-]? ( [0-9]+ "." [0-9]* {EXPONENT} | "."? [0-9]+ {EXPONENT} )
ECHAR                   "\\"[\"\'\\bfnrt]
ANON                    "[" ({WS}|{COMMENT})* "]"
DATATYPE_MARKER         ({WS} | {COMMENT})* "^^"
// LANGTAG_MARKER          ({WS} | {COMMENT})* {LANGTAG}
LANGTAG_MARKER          {LANGTAG}
PN_CHARS_BASE           [A-Z] | [a-z] | [\u00c0-\u00d6] | [\u00d8-\u00f6] | [\u00f8-\u02ff] | [\u0370-\u037d] | [\u037f-\u1fff] | [\u200c-\u200d] | [\u2070-\u218f] | [\u2c00-\u2fef] | [\u3001-\ud7ff] | [\uf900-\ufdcf] | [\ufdf0-\ufffd] | [\uD800-\uDB7F][\uDC00-\uDFFF] // UTF-16 surrogates for [\U00010000-\U000effff]
PN_CHARS_U              {PN_CHARS_BASE} | '_' | '_'
PN_CHARS                {PN_CHARS_U} | '-' | [0-9] | [\u00b7] | [\u0300-\u036f] | [\u203f-\u2040]
BLANK_NODE_LABEL        '_:' ({PN_CHARS_U} | [0-9]) (({PN_CHARS} | '.')* {PN_CHARS})?
//ATBLANK_NODE_LABEL      '@_:' ({PN_CHARS_U} | [0-9]) (({PN_CHARS} | '.')* {PN_CHARS})?
PN_PREFIX               {PN_CHARS_BASE} (({PN_CHARS} | '.')* {PN_CHARS})?
PNAME_NS                {PN_PREFIX}? ':'
HEX                     [0-9] | [A-F] | [a-f]
PERCENT                 '%' {HEX} {HEX}
UCHAR                   '\\u' {HEX} {HEX} {HEX} {HEX} | '\\U' {HEX} {HEX} {HEX} {HEX} {HEX} {HEX} {HEX} {HEX}

STRING_LITERAL1         "'" ([^\u0027\u005c\u000a\u000d] | {ECHAR} | {UCHAR})* "'" /* #x27=' #x5C=\ #xA=new line #xD=carriage return */
STRING_LITERAL2         '"' ([^\u0022\u005c\u000a\u000d] | {ECHAR} | {UCHAR})* '"' /* #x22=" #x5C=\ #xA=new line #xD=carriage return */
STRING_LITERAL_LONG1    "'''" (("'" | "''")? ([^\'\\] | {ECHAR} | {UCHAR}))* "'''"
STRING_LITERAL_LONG2    '"""' (('"' | '""')? ([^\"\\] | {ECHAR} | {UCHAR}))* '"""'

SPARQL_BASE             [Bb][Aa][Ss][Ee]
SPARQL_PREFIX           [Pp][Rr][Ee][Ff][Ii][Xx]
IRIREF                  '<' ([^\u0000-\u0020<>\"{}|^`\\] | {UCHAR})* '>' /* #x00=NULL #01-#x1F=control codes #x20=space */
PN_LOCAL_ESC            '\\' ('_' | '~' | '.' | '-' | '!' | '$' | '&' | "'" | '(' | ')' | '*' | '+' | ',' | ';' | '=' | '/' | '?' | '#' | '@' | '%')
PLX                     {PERCENT} | {PN_LOCAL_ESC}
PN_LOCAL                ({PN_CHARS_U} | ':' | [0-9] | {PLX}) ({PN_CHARS} | '.' | ':' | {PLX})*
PNAME_LN                {PNAME_NS} {PN_LOCAL}

%no-break-if          (.*[^a-z] | '') 'return' ([^a-z].* | '') // elide trailing 'break;'

%%

{DATATYPE_MARKER}       yytext = yy.crackSkipped(yytext, yylloc); return 'DATATYPE_MARKER';
{WS}                    yytext = yy.skip('ws', yytext, yylloc); return 'WS'
{COMMENT}               yytext = yy.skip('comment', yytext, yylloc); return 'COMMENT'
"@base"                 yytext = { type: "KEYWORD", origText: yytext }; return 'BASE';
"@prefix"               yytext = { type: "KEYWORD", origText: yytext }; return 'PREFIX';
{LANGTAG_MARKER}        yytext = yy.crackSkipped(yytext, yylloc); return 'LANGTAG_MARKER';
"true"                  yytext = { type: "boolean", origText: yytext }; return 'IT_true';
"false"                 yytext = { type: "boolean", origText: yytext }; return 'IT_false';
{SPARQL_PREFIX}         yytext = { type: "KEYWORD", origText: yytext }; return 'SPARQL_PREFIX';
{SPARQL_BASE}           yytext = { type: "KEYWORD", origText: yytext }; return 'SPARQL_BASE';

{ANON}                  yytext = yy.createBlankNode("ANON", yytext); return 'ANON';
{IRIREF}                yytext = yy.createRelativeIri(yytext); return 'IRIREF';
{PNAME_LN}              yytext = yy.parsePName(yytext); return 'PNAME_LN';
{PNAME_NS}              yytext = yy.parsePrefix(yytext); return 'PNAME_NS';
{BLANK_NODE_LABEL}      yytext = yy.createBlankNode("BLANK_NODE_LABEL", yytext); return 'BLANK_NODE_LABEL';
{DOUBLE}                yytext = { type: "DOUBLE",  value: yytext, origText: yytext }; return 'DOUBLE';
{DECIMAL}               yytext = { type: "DECIMAL", value: yytext, origText: yytext }; return 'DECIMAL';
{INTEGER}               yytext = { type: "INTEGER", value: yytext, origText: yytext }; return 'INTEGER';
{STRING_LITERAL_LONG1}  yytext = { type: "STRING_LITERAL_LONG1", value: yy.unescapeString(yytext, 3), origText: yytext }; return 'STRING_LITERAL_LONG1';
{STRING_LITERAL_LONG2}  yytext = { type: "STRING_LITERAL_LONG2", value: yy.unescapeString(yytext, 3), origText: yytext }; return 'STRING_LITERAL_LONG2';
{STRING_LITERAL1}       yytext = { type: "STRING_LITERAL1", value: yy.unescapeString(yytext, 1), origText: yytext }; return 'STRING_LITERAL1';
{STRING_LITERAL2}       yytext = { type: "STRING_LITERAL2", value: yy.unescapeString(yytext, 1), origText: yytext }; return 'STRING_LITERAL2';

"a"                     yytext = { type: "keyword", origText: yytext }; return 'RDF_TYPE';
"."                     yytext = { type: "token", origText: yytext }; return 'GT_DOT';
";"                     yytext = { type: "token", origText: yytext }; return 'GT_SEMI';
","                     yytext = { type: "token", origText: yytext }; return 'GT_COMMA';
"["                     yytext = { type: "startBNode", origText: yytext }; return 'GT_LBRACKET';
"]"                     yytext = { type: "endBNode", origText: yytext }; return 'GT_RBRACKET';
"("                     yytext = { type: "startCollection", origText: yytext }; return 'GT_LPAREN';
")"                     yytext = { type: "endCollection", origText: yytext }; return 'GT_RPAREN';
//"^^"                    yytext = { type: "token", origText: yytext }; return 'GT_DTYPE';
<<EOF>>                 return 'EOF';
[a-zA-Z0-9_-]+          return 'unexpected word "'+yytext+'"';
.                       return 'invalid character '+yytext;



/lex

%start turtleDoc

// %left WS
// %left COMMENT


%%

turtleDoc:
      WSS _Qstatement_E_Star EOF	{
        return { statementList: $1.concat($2) };
      }
;

WSS:
      	-> []
    | WSS WS_OR_COMMENT	-> $1.concat([$2])
;

WS_OR_COMMENT:
      WS	
    | COMMENT	
;

_Qstatement_E_Star:
      -> []
    | _Qstatement_E_Star statement WSS	-> $1.concat($2, $3)
;

statement:
      directive	
    | triples GT_DOT	-> $1.concat([$2]);
;

directive:
      prefixID	
    | base	
    | sparqlPrefix	
    | sparqlBase	
;

prefixID:
      PREFIX WSS PNAME_NS WSS IRIREF WSS GT_DOT	{
        yy._prefixes[$3.value] = $5.value;
        $$ = [{ "type": "prefix", keyword: $1, ws1: $2, prefix: $3, ws2: $4, namespace: $5, ws3: $6, dot: $7 }];
      }
;

base:
      BASE WSS IRIREF WSS GT_DOT	{
        yy._setBase(yy._base === null ||
                    absoluteIRI.test($3.value.slice(1, -1)) ? $3.value.slice(1, -1) : yy._resolveIRI($3.value.slice(1, -1)));
        $$ = [{ "type": "base", keyword: $1, ws1: $2, base: $3, ws2: $4, dot: $5 }];
      }
;

sparqlPrefix:
      SPARQL_PREFIX WSS PNAME_NS WSS IRIREF	{
        yy._prefixes[$3.value] = $5.value;
        $$ = [{ "type": "sparqlPrefix", keyword: $1, ws1: $2, prefix: $3, ws2: $4, namespace: $5 }];
      }
;

sparqlBase:
      SPARQL_BASE WSS IRIREF	{
        yy._setBase(yy._base === null ||
                    absoluteIRI.test($3.value.slice(1, -1)) ? $3.value.slice(1, -1) : yy._resolveIRI($3.value.slice(1, -1)));
        $$ = [{ "type": "sparqlBase", keyword: $1, ws1: $2, base: $3 }];
      }
;

triples:
      subject WSS predicateObjectList	-> yy.finishSubject([{ type: "triples", subject: $1, ws1: $2, predicateObjectList: $3}])
    | collection_SUBJECT WSS predicateObjectList	-> yy.finishSubject([{ type: "triples", subject: $1, ws1: $2, predicateObjectList: $3}])
    | blankNodePropertyList_SUBJECT WSS _QpredicateObjectList_E_Opt	-> yy.finishSubject([{ type: "triples", subject: $1, ws1: $2, predicateObjectList: $3}]) // blankNodePropertyList _QpredicateObjectList_E_Opt
;

collection_SUBJECT:
      collection	{ yy.setSubject($1.node); $$ = $1.elts; // collection_SUBJECT
 }
;

blankNodePropertyList_SUBJECT:
      blankNodePropertyList	{ yy.setSubject($1.node); $$ = $1.elts[0]; // blankNodePropertyList_SUBJECT
 }
;

_QpredicateObjectList_E_Opt:
      	-> []
    | predicateObjectList	-> $1;
;

predicateObjectList:
      verb WSS objectList _Q_O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C_E_Star	-> [{ type: "verb_objectList", verb: $1, ws1: $2, objectList: $3 }].concat($4) // verb objectList _Q_O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C_E_Star
;

_O_Qverb_E_S_QobjectList_E_C:
       verb WSS objectList	-> [{ type: "verb_objectList", verb: $1, ws1: $2, objectList: $3 }]
;

_Q_O_Qverb_E_S_QobjectList_E_C_E_Opt:
      	-> []
    | _O_Qverb_E_S_QobjectList_E_C	
;

_O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C:
      GT_SEMI WSS _Q_O_Qverb_E_S_QobjectList_E_C_E_Opt	-> [$1].concat($2, $3)
;

_Q_O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C_E_Star:
      	-> []
    | _Q_O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C_E_Star _O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C	-> $1.concat($2) // Q_O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C_E_Star _O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C
;

objectList:
      object WSS _Q_O_QGT_COMMA_E_S_Qobject_E_C_E_Star	-> yy.finishObjectList($1, $2.concat($3)) // object _Q_O_QGT_COMMA_E_S_Qobject_E_C_E_Star
;

_O_QGT_COMMA_E_S_Qobject_E_C:
      GT_COMMA WSS object WSS	-> [$1].concat($2, $3, $4)
;

_Q_O_QGT_COMMA_E_S_Qobject_E_C_E_Star:
      -> []
    | _Q_O_QGT_COMMA_E_S_Qobject_E_C_E_Star _O_QGT_COMMA_E_S_Qobject_E_C	-> $1.concat($2) // Q_O_QGT_COMMA_E_S_Qobject_E_C_E_Star _O_QGT_COMMA_E_S_Qobject_E_C
;

verb:
      predicate	-> yy.setPredicate($1)
    | RDF_TYPE	-> yy.setPredicate({ "type": "a", "origText": "a" }) // left is a token, right a const
;

subject:
      iri	-> yy.setSubject($1)
    | BlankNode	-> yy.setSubject($1)
//    | collection	-> yy.collectionSubject($1)
;

predicate:
      iri	
;

object:
      iri	-> [yy.finishTriple($1)]
    | BlankNode	-> [yy.finishTriple($1)]
    | collection	{yy.finishTriple($1.node); $$ = $1.elts} // object collection
    | blankNodePropertyList	{ yy.finishTriple($1.node); $$ = $1.elts; } // blankNodePropertyList
    | literal	-> [yy.finishTriple($1)]
;

literal:
      RDFLiteral	
    | NumericLiteral	
    | BooleanLiteral	
;

blankNodePropertyList:
      NEW_SUBJECT WSS predicateObjectList GT_RBRACKET	-> yy.finishBlankNodePropertyList($1, $2, $3, $4)
;

NEW_SUBJECT:
      GT_LBRACKET 	-> yy.startBlankNodePropertyList($1);
;

collection:
      GT_LPAREN _Qobject_E_Star WSS GT_RPAREN	-> yy.makeFirstRest($1, $2, $3, $4)
;

_Qobject_E_Star:
      -> []
    | _Qobject_E_Star WSS collectionObject	-> $1.concat({ws0: $2, node: $3.node, elts: $3.elts}) // Qobject_E_Star object -- collectionObject
;

collectionObject:
      iri	-> {node: $1, elts: [$1]}
    | BlankNode	-> {node: $1, elts: [$1]}
    | collection	-> $1 // collection collection
    | blankNodePropertyList	-> {node: $1.node, elts: $1.elts} // collection blankNodePropertyList
    | literal	-> {node: $1, elts: [$1]}
;

NumericLiteral:
      INTEGER	-> yy.createTypedLiteral($1, XSD_INTEGER)
    | DECIMAL	-> yy.createTypedLiteral($1, XSD_DECIMAL)
    | DOUBLE	-> yy.createTypedLiteral($1, XSD_DOUBLE)
;

RDFLiteral:
      String _Q_O_QLANGTAG_E_Or_QGT_DTYPE_E_S_Qiri_E_C_E_Opt	-> yy.createParsedLiteral($2.type, $1, $2.attrs)
;

_O_QLANGTAG_E_Or_QGT_DTYPE_E_S_Qiri_E_C:
      LANGTAG_MARKER	-> { type: "langTagLiteral", attrs: { language: { type: "LANGTAG", ws0: $1.ws, value: yytext.rest.substring(1), origText: $1.rest } } }
    | DATATYPE_MARKER WSS iri	-> { type: "datatypedLiteral", attrs: { datatype: { type: "ParsedDatatype", ws0: $1.ws, token: { type: "token", origText: $1.rest }, ws1: $2, iri: $3 } } }
;

_Q_O_QLANGTAG_E_Or_QGT_DTYPE_E_S_Qiri_E_C_E_Opt:
      	-> { type: "simpleLiteral", attrs: {} }
    | _O_QLANGTAG_E_Or_QGT_DTYPE_E_S_Qiri_E_C	-> $1
;

BooleanLiteral:
      IT_true	-> yy.createTypedLiteral($1, XSD_BOOLEAN)
    | IT_false	-> yy.createTypedLiteral($1, XSD_BOOLEAN)
;



String:
      STRING_LITERAL1	
    | STRING_LITERAL2	
    | STRING_LITERAL_LONG1	
    | STRING_LITERAL_LONG2	
;

iri:
      IRIREF	
    | PrefixedName	
;

PrefixedName:
      PNAME_LN	
    | PNAME_NS	
;

BlankNode:
      BLANK_NODE_LABEL	
    | ANON	
;
