class UnexpectedType extends Error {
  constructor (obj, expected) {
    super(`expected only ${expected} in ${JSON.stringify(obj)}`);
    this.obj = obj;
    this.expected = expected;
  }
}

class RenderClickableLd {
  constructor (dom, baseIRI, text, mediaType, classSubstitutions = {}) {
    this.dom = dom;
    this.baseIRI = baseIRI;
    this.text = text;
    this.mediaType = mediaType;
    this.classSubstitutions = classSubstitutions;
  }

  render (element) {
    if (this.mediaType !== 'text/turtle')
      throw Error(`media type ${this.mediaType} not supported; only "text/turtle" for now`);
    const parser = new TurtleParser.TurtleParser({baseIRI: this.baseIRI});
    const [parseTree, quads] = parser.parse(this.text);
    // element.innerText = TurtleJisonContext.exports.origText(parseTree).join('');
    this.renderStatementList(parseTree.statementList, element);
  }

  renderStatementList (statementList, element) {
    for (const statementOrWs of statementList) {
      this.renderStatement(statementOrWs, element);
    }
  }

  renderStatement (statementOrWs, element) {
    const expected = [
      "ws",  "comment",
      "n3Prefix", "n3Base", "sparqlPrefix", "sparqlBase", "collection_predicateObjectList", "subject_predicateObjectList"
    ];
    switch (statementOrWs.type) {
    case expected[0]: this.renderSkippedElt(statementOrWs, element); break; // "ws"
    case expected[1]: this.renderSkippedElt(statementOrWs, element); break; // "comment"
    case expected[2]: this.renderDirective(statementOrWs, element); break; // prefix
    case expected[3]: this.renderDirective(statementOrWs, element); break; // base
    case expected[4]: this.renderDirective(statementOrWs, element); break; // sparqlPrefix
    case expected[5]: this.renderDirective(statementOrWs, element); break; // sparqlBase
    case expected[6]: // collection_predicateObjectList - TODO: remove?
    case expected[7]: this.renderSubject_predicateObjectList(statementOrWs); break; // "subject_predicateObjectList"
    default: throw new UnexpectedType(statementOrWs, expected);
    }
  }

  renderDirective (statementOrWs, element) {
    const expected = [
      "n3Prefix", "n3Base", "sparqlPrefix", "sparqlBase"
    ];
    const ret = this.span("directive", element);
    switch (statementOrWs.type) {
    case expected[0]: this.renderN3Prefix(statementOrWs, ret); break; // prefix
    case expected[1]: this.renderN3Base(statementOrWs, ret); break; // base
    case expected[2]: this.renderSparqlPrefix(statementOrWs, ret); break; // sparqlPrefix
    case expected[3]: this.renderSparqlBase(statementOrWs, ret); break; // sparqlBase
    default: throw new UnexpectedType(statementOrWs, expected);
    }
    return ret;
  }

  renderSparqlPrefix (sparqlPrefix, element) {
    const ret = this.span("sparqlPrefix", element);
    this.renderKeyword(sparqlPrefix.keyword, ret);
    this.renderSkippedList(sparqlPrefix.ws1, ret);
    this.renderPrefix(sparqlPrefix.prefix, ret);
    this.renderSkippedList(sparqlPrefix.ws2, ret);
    this.renderNamespace(sparqlPrefix.namespace, ret);
    return ret;
  }

  renderPrefix (prefix, element) {
    const ret = this.span("prefix", element);
    ret.innerText = prefix.origText; // or value + ':'
    return ret;
  }

  renderNamespace (namespace, element) {
    const ret = this.span("namespace", element);
    this.renderTerm(namespace, ret); // renderIriForm?
    return ret;
  }

  renderTerm (term, element) {
    const expected = [
      "relativeUrl",  "pname",
      "BLANK_NODE_LABEL", "ANON", "blankNodePropertyList", "collection",
      "simpleLiteral", "datatypedLiteral", "langTagLiteral"
    ];
    const ret = this.span("term", element);
    switch (term.type) {
    case expected[0]: this.renderRelativeUrl(term, element); break; // relativeUrl
    case expected[1]: this.renderPname(term, element); break; // pname
    case expected[2]: this.renderBLANK_NODE_LABEL(term, element); break; // BLANK_NODE_LABEL
    case expected[3]: this.renderANON(term, element); break; // ANON
    case expected[4]: this.renderBlankNodePropertyList(term, element); break; // blankNodePropertyList
    case expected[5]: this.renderCollection(term, element); break; // collection
    case expected[6]: this.renderSimpleLiteral(term, element); break; // simpleLiteral
    case expected[7]: this.renderDatatypedLiteral(term, element); break; // datatypedLiteral
    case expected[8]: this.renderLangTagLiteral(term, element); break; // langTagLiteral
    default: throw new UnexpectedType(term, expected);
    }
    return ret;
  }

  renderRelativeUrl (relativeUrl, element) {
    const ret = this.span("relativeUrl", element);
    ret.innerText = relativeUrl.origText;
    return ret;
  }

  renderPname (pname, element) {
    const ret = this.span("pname", element);
    this.renderPrefix(pname.prefix, ret);
    this.renderLocalName(pname.localName, ret);
    return ret;
  }

  renderLocalName (localName, element) {
    const ret = this.span("localName", element);
    this.renderTerm(localName, ret); // renderIriForm?
    return ret;
  }

  renderBLANK_NODE_LABEL (LABEL, element) {
    const ret = this.span("BLANK_NODE_LABEL", element);
    ret.innerText = BLANK_NODE_LABEL.origText;
    return ret;
  }

  renderANON (ANON, element) {
    const ret = this.span("ANON", element);
    ret.innerText = ANON.origText;
    return ret;
  }

  renderBlankNodePropertyList (blankNodePropertyList, element) {
    const ret = this.span("blankNodePropertyList", element);
    ret.innerText = blankNodePropertyList.origText;
    return ret;
  }

  renderCollection (collection, element) {
    const ret = this.span("collection", element);
    ret.innerText = collection.origText;
    return ret;
  }

  renderString (string, element) {
    const ret = this.span("string", element);
    ret.innerText = string.origText;
    return ret;
  }

  renderSimpleLiteral (simpleLiteral, element) {
    const ret = this.span("simpleLiteral", element);
    this.renderString(simpleLiteral.String, ret);
    return ret;
  }

  renderDatatypedLiteral (datatypedLiteral, element) {
    const ret = this.span("datatypedLiteral", element);
    this.renderString(datatypedLiteral.String, ret);
    this.renderDatatype(datatypedLiteral.String, ret);
    return ret;
  }

  renderLangTagLiteral (langTagLiteral, element) {
    const ret = this.span("langTagLiteral", element);
    this.renderString(langTagLiteral.String, ret);
    this.renderLanguage(langTagLiteral.language, ret);
    return ret;
  }

  renderDatatype (datatype, element) {
    const ret = this.span("datatype", element);
    this.renderTerm(datatype, ret); // renderIriForm?
    return ret;
  }


  renderLanguage (language, element) {
    const ret = this.span("language", element);
    ret.innerText = language.origText; // or '@' + value
    return ret;
  }

  renderSkippedList (skippedList, element) {
    const ret = this.span("skippedList", element);
    for (const skippedElt of skippedList)
      this.renderSkippedElt(skippedElt, ret);
    return ret;
  }

  renderSkippedElt (skippedElt, element) {
    const expected = ["ws",  "comment"];
    const ret = this.span("skippedElt", element);
    switch (skippedElt.type) {
    case expected[0]: this.renderWs(skippedElt, ret); break; // ws
    case expected[1]: this.renderComment(skippedElt, ret); break; // comment
    default: throw new UnexpectedType(skipped, expected);
    }
    return ret;
  }

  renderWs (ws, element) {
    const ret = this.span("ws", element);
    ret.innerText = ws.origText;
    return ret;
  }

  renderComment (comment, element) {
    const ret = this.span("comment", element);
    ret.innerText = comment.origText;
    return ret;
  }

  renderKeyword (keyword, element) {
    const ret = this.span("keyword", element);
    ret.innerText = keyword.origText;
    return ret;
  }

  span (className, parent, attrs = {}) {
    const nm = className in this.classSubstitutions ? this.classSubstitutions[className] : className;
    if (nm === ".") // no new span for this class
      return parent;

    const ret = this.dom.createElement('span');
    if (nm)
      ret.classList.add(nm);
    parent.append(ret);
    return ret;
  }
}

/*
function renderSubject_predicateObjectList (subject) {
}
"subject": { "type": "relativeUrl", "value": "a", "origText": "<a>",
                         "term": { "termType": "NamedNode", "value": "a" } },

"ws1": [ { "type": "ws", "origText": " " } ],
function renderPredicateObjectList (predicateObjectList) {
}
              {
                function renderVerb_objectList (verb) {
                }"verb": { "type": "relativeUrl", "value": "b", "origText": "<b>",
                          "term": { "termType": "NamedNode", "value": "b" } },
                "ws1": [ { "type": "ws", "origText": " " } ],

                function renderObjectList (objectList) {
                }

                function renderTerm (term) {
                  switch (term.type) {
                    case 
                  }
                }
                { "type": "relativeUrl", "value": "c", "origText": "<c>",
                    "term": { "termType": "NamedNode", "value": "c" } },
                  { "type": "ws", "origText": " " }
                ] }
            ] },
          { "type": "token", "origText": "." }
        ]
      });
*/


if (typeof module !== "undefined") {
  module.exports = {
    RenderClickableLd
  }
}
