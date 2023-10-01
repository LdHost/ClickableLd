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


  // Creates a literal with the given value and type
  function createLiteral(value, type) {
    return { value: value, type: type };
  }

  // Regular expression and replacement strings to escape strings
  const stringEscapeReplacements = { '\\': '\\', "'": "'", '"': '"',
                                   't': '\t', 'b': '\b', 'n': '\n', 'r': '\r', 'f': '\f' },
      semactEscapeReplacements = { '\\': '\\', '%': '%' },
      pnameEscapeReplacements = {
        '\\': '\\', "'": "'", '"': '"',
        'n': '\n', 'r': '\r', 't': '\t', 'f': '\f', 'b': '\b',
        '_': '_', '~': '~', '.': '.', '-': '-', '!': '!', '$': '$', '&': '&',
        '(': '(', ')': ')', '*': '*', '+': '+', ',': ',', ';': ';', '=': '=',
        '/': '/', '?': '?', '#': '#', '@': '@', '%': '%',
      };


  // Translates string escape codes in the string into their textual equivalent
  function unescapeString(string, trimLength) {
    string = string.substring(trimLength, string.length - trimLength);
    return unescapeText(string, stringEscapeReplacements);
  }

  function unescapeLangString(string, trimLength) {
    const at = string.lastIndexOf("@");
    const lang = string.substr(at);
    string = string.substr(0, at);
    const u = unescapeString(string, trimLength);
    return extend(u, { language: lowercase(lang.substr(1)) });
  }

  function unescapeText (string, replacements) {
    const regex = /\\u([a-fA-F0-9]{4})|\\U([a-fA-F0-9]{8})|\\(.)/g;
    try {
      string = string.replace(regex, function (sequence, unicode4, unicode8, escapedChar) {
        let charCode;
        if (unicode4) {
          charCode = parseInt(unicode4, 16);
          if (isNaN(charCode)) throw new Error(); // can never happen (regex), but helps performance
          return String.fromCharCode(charCode);
        }
        else if (unicode8) {
          charCode = parseInt(unicode8, 16);
          if (isNaN(charCode)) throw new Error(); // can never happen (regex), but helps performance
          if (charCode < 0xFFFF) return String.fromCharCode(charCode);
          return String.fromCharCode(0xD800 + ((charCode -= 0x10000) >> 10), 0xDC00 + (charCode & 0x3FF));
        }
        else {
          const replacement = replacements[escapedChar];
          if (!replacement) throw new Error("no replacement found for '" + escapedChar + "'");
          return replacement;
        }
      });
      return string;
    }
    catch (error) { console.warn(error); return ''; }
  }
%}

/* lexical grammar */
%lex

LANGTAG                 "@"([A-Za-z])+(("-"([0-9A-Za-z])+))*
INTEGER                 ([+-])?([0-9])+
DECIMAL                 ([+-])?([0-9])*"."([0-9])+
EXPONENT                [Ee]([+-])?([0-9])+
DOUBLE                  ([+-])?((([0-9])+"."([0-9])*({EXPONENT}))|((".")?([0-9])+({EXPONENT})))
ECHAR                   "\\"[\"\'\\bfnrt]
WS                      (" ")|(("\t")|(("\r")|("\n")))
ANON                    "\["(({WS}))*"\]"
PN_CHARS_BASE           [A-Z] | [a-z] | [\u00c0-\u00d6] | [\u00d8-\u00f6] | [\u00f8-\u02ff] | [\u0370-\u037d] | [\u037f-\u1fff] | [\u200c-\u200d] | [\u2070-\u218f] | [\u2c00-\u2fef] | [\u3001-\ud7ff] | [\uf900-\ufdcf] | [\ufdf0-\ufffd] | [\uD800-\uDB7F][\uDC00-\uDFFF] // UTF-16 surrogates for [\U00010000-\U000effff]
PN_CHARS_U              {PN_CHARS_BASE} | '_' | '_' /* !!! raise jison bug */
PN_CHARS                {PN_CHARS_U} | '-' | [0-9] | [\u00b7] | [\u0300-\u036f] | [\u203f-\u2040]
BLANK_NODE_LABEL        '_:' ({PN_CHARS_U} | [0-9]) (({PN_CHARS} | '.')* {PN_CHARS})?
//ATBLANK_NODE_LABEL        '@_:' ({PN_CHARS_U} | [0-9]) (({PN_CHARS} | '.')* {PN_CHARS})?
PN_PREFIX               {PN_CHARS_BASE} (({PN_CHARS} | '.')* {PN_CHARS})?
PNAME_NS                {PN_PREFIX}? ':'
HEX                     [0-9] | [A-F] | [a-f]
PERCENT                 '%' {HEX} {HEX}
UCHAR                   '\\u' {HEX} {HEX} {HEX} {HEX} | '\\U' {HEX} {HEX} {HEX} {HEX} {HEX} {HEX} {HEX} {HEX}

STRING_LITERAL1         "'" ([^\u0027\u005c\u000a\u000d] | {ECHAR} | {UCHAR})* "'" /* #x27=' #x5C=\ #xA=new line #xD=carriage return */
STRING_LITERAL2         '"' ([^\u0022\u005c\u000a\u000d] | {ECHAR} | {UCHAR})* '"' /* #x22=" #x5C=\ #xA=new line #xD=carriage return */
STRING_LITERAL_LONG1    "'''" (("'" | "''")? ([^\'\\] | {ECHAR} | {UCHAR}))* "'''"
//NON_TERMINATED_STRING_LITERAL_LONG1    "'''"
STRING_LITERAL_LONG2    '"""' (('"' | '""')? ([^\"\\] | {ECHAR} | {UCHAR}))* '"""'
//NON_TERMINATED_STRING_LITERAL_LONG2    '"""'

SPARQL_BASE             [Bb][Aa][Ss][Ee]
SPARQL_PREFIX           [Pp][Rr][Ee][Ff][Ii][Xx]
// IRIREF                    '<' 'http://a.example/ns' '>'
IRIREF                  '<' ([^\u0000-\u0020<>\"{}|^`\\] | {UCHAR})* '>' /* #x00=NULL #01-#x1F=control codes #x20=space */
PN_LOCAL_ESC            '\\' ('_' | '~' | '.' | '-' | '!' | '$' | '&' | "'" | '(' | ')' | '*' | '+' | ',' | ';' | '=' | '/' | '?' | '#' | '@' | '%')
PLX                     {PERCENT} | {PN_LOCAL_ESC}
PN_LOCAL                ({PN_CHARS_U} | ':' | [0-9] | {PLX}) ({PN_CHARS} | '.' | ':' | {PLX})*
PNAME_LN                {PNAME_NS} {PN_LOCAL}
COMMENT                 '#' [^\u000a\u000d]* | "/*" ([^*] | '*' ([^/] | '\\/'))* "*/"

%no-break-if          (.*[^a-z] | '') 'return' ([^a-z].* | '') // elide trailing 'break;'

%%

\s+           {
  // space eaten by whitespace and comments
  if (yy.skipped.last_line === yylloc.first_line &&
      yy.skipped.last_column === yylloc.first_column) {
    // immediately follows a skipped span
    yy.skipped.last_line = yylloc.last_line;
    yy.skipped.last_column = yylloc.last_column;
  } else {
    // follows something else
    yy.skipped = yylloc
  };
  yy.addWhitespace({type: "ws", origText: yytext});
}
{COMMENT}           {
  // space eaten by whitespace and comments
  if (yy.skipped.last_line === yylloc.first_line &&
      yy.skipped.last_column === yylloc.first_column) {
    // immediately follows a skipped span
    yy.skipped.last_line = yylloc.last_line;
    yy.skipped.last_column = yylloc.last_column;
  } else {
    // follows something else
    yy.skipped = yylloc
  };
  yy.addWhitespace(yytext);
}
"."                     return 'GT_DOT';
";"                     return 'GT_SEMI';
","                     return 'GT_COMMA';
"["                     return 'GT_LBRACKET';
"]"                     return 'GT_RBRACKET';
"("                     return 'GT_LPAREN';
")"                     return 'GT_RPAREN';
"^^"                    return 'GT_DTYPE';
"true"                  return 'IT_true';
"false"                 return 'IT_false';
{SPARQL_PREFIX}         return 'SPARQL_PREFIX';
{SPARQL_BASE}           return 'SPARQL_BASE';
"@base"                 return 'BASE';
"@prefix"               return 'PREFIX';
{IRIREF}                const unesc = unescapeText(yytext.substring(1, yytext.length - 1), {}); yytext = { "type": "relativeUrl", "value": yy._base === null || absoluteIRI.test(unesc) ? unesc : yy._resolveIRI(unesc) , "origText": yytext }; return 'IRIREF';
{PNAME_LN}              return 'PNAME_LN';
{PNAME_NS}              return 'PNAME_NS';
{BLANK_NODE_LABEL}      return 'BLANK_NODE_LABEL';
{LANGTAG}               return 'LANGTAG';
{INTEGER}               return 'INTEGER';
{DECIMAL}               return 'DECIMAL';
{DOUBLE}                return 'DOUBLE';
{STRING_LITERAL1}       return 'STRING_LITERAL1';
{STRING_LITERAL2}       return 'STRING_LITERAL2';
{STRING_LITERAL_LONG1}  return 'STRING_LITERAL_LONG1';
{STRING_LITERAL_LONG2}  return 'STRING_LITERAL_LONG2';
{ANON}                  return 'ANON';
"a"                     return 'RDF_TYPE';
<<EOF>>                 return 'EOF';
[a-zA-Z0-9_-]+          return 'unexpected word "'+yytext+'"';
.                       return 'invalid character '+yytext;

/lex

%start turtleDoc


%%

turtleDoc:
      WS _Qstatement_E_Star EOF	{
        return { statementList: $1.concat($2) };
      }
;

WS:
      -> yy.getWhitespace()
;

_Qstatement_E_Star:
      -> []
    | _Qstatement_E_Star statement	-> $1.concat($2)
;

statement:
      directive	
    | triples GT_DOT	
;

directive:
      prefixID	
    | base	
    | sparqlPrefix	
    | sparqlBase	
;

prefixID:
      PREFIX PNAME_NS IRIREF GT_DOT	{
        yy._prefixes[$2.slice(0, -1)] = $3;
      }
;

base:
      BASE IRIREF GT_DOT	{
        yy._setBase(yy._base === null ||
                    absoluteIRI.test($2.slice(1, -1)) ? $2.slice(1, -1) : yy._resolveIRI($2.slice(1, -1)));
      }
;

sparqlPrefix:
      SPARQL_PREFIX WS PNAME_NS WS IRIREF	{
        yy._prefixes[$3.slice(0, -1)] = $5.value;
        $$ = [{ "type": "sparqlPrefix", ws1: $2, prefix: $3, ws2: $4, namespace: $5 }].concat(yy.getWhitespace());
      }
;

sparqlBase:
      SPARQL_BASE IRIREF	{
        yy._setBase(yy._base === null ||
                    absoluteIRI.test($2.slice(1, -1)) ? $2.slice(1, -1) : yy._resolveIRI($2.slice(1, -1)));
      }
;

triples:
      subject WS predicateObjectList	-> yy.finishSubject([{ type: "subject_predicateObjectList", subject: $1, ws1: $2, predicateObjectList: $3}].concat(yy.getWhitespace()))
    | blankNodePropertyList _QpredicateObjectList_E_Opt	-> yy.finishSubject($1.concat($2)) // blankNodePropertyList _QpredicateObjectList_E_Opt
;

_QpredicateObjectList_E_Opt:
      -> []
    | predicateObjectList	
;

predicateObjectList:
      verb WS objectList WS _Q_O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C_E_Star	-> { type: "verb_objectList", verb: $1, ws1: $2, objectList: $3.concat($4, $5) } // verb objectList _Q_O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C_E_Star
;

_O_Qverb_E_S_QobjectList_E_C:
      verb objectList	-> $2
;

_Q_O_Qverb_E_S_QobjectList_E_C_E_Opt:
      -> []
    | _O_Qverb_E_S_QobjectList_E_C	
;

_O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C:
      GT_SEMI _Q_O_Qverb_E_S_QobjectList_E_C_E_Opt	-> $2
;

_Q_O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C_E_Star:
      -> []
    | _Q_O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C_E_Star _O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C	-> $1.concat($2) // Q_O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C_E_Star _O_QGT_SEMI_E_S_Qverb_E_S_QobjectList_E_Opt_C
;

objectList:
      object WS _Q_O_QGT_COMMA_E_S_Qobject_E_C_E_Star	-> yy.finishObjectList($1.concat($2, $3)) // object _Q_O_QGT_COMMA_E_S_Qobject_E_C_E_Star
;

_O_QGT_COMMA_E_S_Qobject_E_C:
      GT_COMMA WS object	-> $2.concat($3)
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
    | collection	-> yy.collectionSubject($1)
;

predicate:
      iri	
;

object:
      iri	-> [yy.finishTriple($1)]
    | BlankNode	-> [yy.finishTriple($1)]
    | collection	-> [yy.finishTriple($1[0].subject)].concat($1) // collection
    | blankNodePropertyList	-> [yy.finishTriple($1[0].subject)].concat($1) // blankNodePropertyList
    | literal	-> [yy.finishTriple($1)]
;

literal:
      RDFLiteral	
    | NumericLiteral	
    | BooleanLiteral	
;

blankNodePropertyList:
      GT_LBRACKET NEW_SUBJECT predicateObjectList GT_RBRACKET	-> yy.finishBlankNodePropertyList($3, $2)
;

NEW_SUBJECT:
      -> yy.startBlankNodePropertyList();
;

collection:
      GT_LPAREN _Qobject_E_Star GT_RPAREN	-> $2
;

_Qobject_E_Star:
      -> []
    | _Qobject_E_Star collectionObject	-> $1.concat($2) // Qobject_E_Star object
;

collectionObject:
      iri	-> {node: $1, nested: []}
    | BlankNode	-> {node: $1, nested: []}
    | collection	-> yy.makeFirstRest($1) // collection
    | blankNodePropertyList	-> {node: $1[0].subject, nested: $1} // blankNodePropertyList
    | literal	-> {node: $1, nested: []}
;

NumericLiteral:
      INTEGER	-> yy.createLiteral($1, XSD_INTEGER)
    | DECIMAL	-> yy.createLiteral($1, XSD_DECIMAL)
    | DOUBLE	-> yy.createLiteral($1, XSD_DOUBLE)
;

RDFLiteral:
      String _Q_O_QLANGTAG_E_Or_QGT_DTYPE_E_S_Qiri_E_C_E_Opt	-> yy.createLiteral($1, $2)
;

_O_QLANGTAG_E_Or_QGT_DTYPE_E_S_Qiri_E_C:
      LANGTAG	
    | GT_DTYPE iri	
;

_Q_O_QLANGTAG_E_Or_QGT_DTYPE_E_S_Qiri_E_C_E_Opt:
      -> null
    | _O_QLANGTAG_E_Or_QGT_DTYPE_E_S_Qiri_E_C	
;

BooleanLiteral:
      IT_true	-> yy.createLiteral($1, XSD_BOOLEAN)
    | IT_false	-> yy.createLiteral($1, XSD_BOOLEAN)
;



String:
      STRING_LITERAL1	-> { type: "STRING_LITERAL1", value: unescapeString($1, 1), origText: $1 }
    | STRING_LITERAL2	-> { type: "STRING_LITERAL2", value: unescapeString($1, 1), origText: $1 }
    | STRING_LITERAL_LONG1	-> { type: "STRING_LITERAL_LONG1", value: unescapeString($1, 3), origText: $1 }
    | STRING_LITERAL_LONG2	-> { type: "STRING_LITERAL_LONG1", value: unescapeString($1, 3), origText: $1 }
;

iri:
      IRIREF	
    | PrefixedName	
;

PrefixedName:
      PNAME_LN	{
        const namePos1 = $1.indexOf(':');
        const prefix = $1.substring(0, namePos1);
        const localName = $1.substring(namePos1 + 1);
        const unescaped = unescapeText(localName, pnameEscapeReplacements);
        const value = yy.expandPrefix(prefix) + unescaped;
        $$ = { "type": "pname", "value": value, "prefix": { "type": "prefix", "value": prefix, "origText": prefix + ":"}, "localName": { "type": "localName", "value": unescaped, "origText": localName} }
      }
    | PNAME_NS	{
        $$ = yy.expandPrefix($1.substr(0, $1.length - 1), yy);
      }
;

BlankNode:
      BLANK_NODE_LABEL	-> yy.createBlankNode($1)
    | ANON	-> yy.createBlankNode()
;
