
class ExtensionList {
  constructor () {
    this.extensions = [];
  }

  add (ext) {
    this.extensions.push(ext);
  }

  ready () {
    return Promise.all(
      this.extensions.filter(
        e => typeof e.ready === "function"
      ).map(
        e => e.ready()
      ));
  }

  findOwner (targetUrlStr, element, title, popup) {
    return this.extensions.find(ext => ext.adopt(targetUrlStr, element, title, popup));
  }
}
const extensionList = new ExtensionList();

class LocalCachedList {
  constructor (base) {
    this.loaded = [];
    const listUrl = new URL("tooltips/_list.json", base);
    this.list = fetch(listUrl)
      .then(resp => resp.text())
      .then(text => {
        const list = JSON.parse(text);
        for (const src of list) {
          if (src.url) {
            src.ready = fetch(new URL(src.url, listUrl))
              .then(resp => resp.json())
              .then(deets => { // hack in something to display in the namespace decl
                deets[src.namespace] = {label: src.label, definition: `namespace for ${src.label}`};
                return deets;
              });
          } else {
            const deets = {}
            deets[src.namespace] = {label: src.label, definition: `namespace for ${src.label}`};
            src.ready = Promise.resolve(deets);
          }
          this.loaded.push(src);
        }
        return list;
      })
      .catch(
        e => {
          console.log(e instanceof Error);
          throw e;
        }
      );
  }
  ready () { return this.list; }
  adopt (targetUrlStr, element, title, popup) {
    const matched = this.loaded.find(l => targetUrlStr.indexOf(l.namespace) === 0);
    if (!matched) return null;
    matched.ready.then(deets => {
      const x = deets[targetUrlStr];
      if (x)
        return popup(element, title, x.label, x.definition);
    })
      .catch(
        e => popup(element, title, e.stack)
      );
    return true;
  }
}
extensionList.add(new LocalCachedList(location));

// no CORS at remote site requires local cache; makes this of limited utility
class Hpp {
  constructor (base) {
    // this.hpo_data = fetch("https://github.com/obophenotype/human-phenotype-ontology/releases/latest/download/hp.json") CORS hell
    this.hpo_data = fetch("extensions/hpo-data.json")
      .then(resp => resp.text())
      .then(text => JSON.parse(text)/*.graphs[0].nodes*/)
      .catch(e => {console.log(e instanceof Error); throw e;});
  }
  adopt (targetUrlStr, element, title, popup) {
    if (!targetUrlStr.startsWith('http://purl.obolibrary.org/obo/HP_'))
      return false;
    this.hpo_data
      .then(nodes => {
        const x = nodes.find(n => n.id === targetUrlStr);
        return popup(element, title, x ? x.lbl : "???");
      })
      .catch(e => popup(element, title, e.message));
    return true;
  }
}
// extensionList.add(new Hpp(location));

// requires CORS headers at schema site; pretty unlikely
class DereferenceSchema {
  constructor (base) {
    this.sparql = new Comunica.QueryEngine();
    this.fetches = new Map();
  }
  adopt (targetUrlStr, element, title, popup) {
    const docUrl = new URL(targetUrlStr);
    docUrl.fragment = null;
    const docUrlStr = docUrl.href;
    if (!this.fetches.has(docUrlStr))
      this.fetches.set(docUrlStr, fetch(docUrlStr, {headers: {redirect: 'follow', accept: 'text/turtle'} }).then(
        async resp => {
          const body = await resp.text();
          return {docUrl, resp, body};
        },
        err => {
          return {docUrl, err};
        }
      ));

    popup(element, title, async () => {
      const x = await this.fetches(docUrl);
      return `{{docUrl}}`;
    });
  }
}
// extensionList.add(new DereferenceSchema(location)); // should be at bottom as it accepts everything

const BROWSE_PARAM = 'browse';
let Interface = null;
let VisitedDocs = null;
let VisitedTreeRoot = null;
const VisitedTreeIds = new Set();
let VisitedTree = null;

const Elts = {
  pageInput: document.querySelector('#page input'),
  renderElement: document.querySelector('.clickable'),
  messagesList: document.querySelector('#messages ol'),
  popup: document.querySelector('#popup-window'),
  popupTitle: document.querySelector('#popup-window h3'),
  popupLabel: document.querySelector('#popup-window .label'),
  popupDefinition: document.querySelector('#popup-window .definition'),
  visitedTree: document.querySelector('#visited-tree'),
};

// window.addEventListener("load", onLoad);
document.addEventListener("DOMContentLoaded", onLoad);
window.addEventListener("popstate", popState);

async function popState (evt) {
  onLoad(evt);
//  VisitedTree = new Tree('#visited-tree', {data: [VisitedDocs]});
}

function log (className, msg) {
  const li = document.createElement('li');
  li.className = className;
  li.innerText = msg;
  document.querySelector('#messages').prepend(li);
}

async function onLoad (evt) {
  Elts.pageInput.oninput = inputDoc;
  Interface = new URL(location);
  Interface.search = Interface.hash = '';
  const params = new URLSearchParams(location.search);
  const docUrlStr = params.get(BROWSE_PARAM);
  if (docUrlStr) {
    Elts.pageInput.value = docUrlStr;
    inputDoc.call(Elts.pageInput, evt);
  }
}

async function inputDoc (evt) {
  if (this.value)
    renderDoc(this.value, new URL(document.location));
}

async function renderDoc (urlStr, oldBase) {
  const docBase = new URL(urlStr, oldBase);
  const resp = await fetch(docBase);
  const body = await resp.text();
  if (!resp.ok)
    throw Error(`fetch(${urlStr}) => ${resp.code}:\n${body}`);

  message(` ${new URL(urlStr, oldBase).href}`);
  Elts.renderElement.replaceChildren(); // clear out rendering area

  const contentType = resp.headers.get("Content-Type");
  if (contentType && contentType !== 'text/turtle')
    throw Error(`media type ${contentType} not supported; only "text/turtle" for now`);

  const parser = new TurtleParser.TurtleParser({baseIRI: docBase.href});
  const parseTree = parser.parse(body);

  await extensionList.ready();
  new RenderClickableLd(document, {
    sparqlPrefix: {useParent: true},
    skipped: {useParent: true},
    namespace: {useParent: true},
    statementOrWs: {useParent: true},
    BuiltInDatatype: {useParent: true},

    pname: { construct: makeLink.bind(null, docBase) },
    relativeUrl: { construct: makeLink.bind(null, docBase) },
    BLANK_NODE_LABEL: { className: "bnode" },
    ANON: { className: "bnode" },
    // blankNodePropertyList: { className: "blankNodePropertyList123" },
    "blankNodePropertyList/start": { className: "bnode" },
    "blankNodePropertyList/end": { className: "bnode" },
    collection: { className: "bnode" },
    simpleLiteral: { className: "literal" },
    datatypedLiteral: { className: "literal" },
    langTagLiteral: { className: "literal" },
  }).render(parseTree, Elts.renderElement);

  document.title = urlStr;

  if (!VisitedTreeIds.has(docBase.href)) {
    let text = null;
    const targetSegments = docBase.pathname.split('/').slice(1); // skip leading empty segment
    const renderFrom = new URL('/', docBase);
    if (VisitedTreeRoot === null) {
      // First entry rendered so no root
      text = targetSegments.pop();
      renderFrom.pathname = targetSegments.join('/');
      VisitedTreeRoot = new URL(renderFrom);
      VisitedDocs = {
        id: renderFrom.href,
        text: renderFrom.href,
        children: [{
          id: docBase.href,
          text: text,
        }]
      };
    } else {
      const rootSegments = VisitedTreeRoot.pathname.split('/').slice(1); // skip leading empty segment
      const docSegments = docBase.pathname.split('/').slice(1);
      if (docBase.href.startsWith(VisitedTreeRoot.href)) {
        // Fits underneath current root
        const addMe = docSegments.slice(rootSegments.length);
        text = addMe.pop();
        let node = VisitedDocs;
        let next;
        // walk the nodes they have in common
        while ((next = node.children.find(n => n.text === addMe[0]))) {
          node = next;
          addMe.shift();
        }
        // extend with any remaining addMe (dirs in the docBase)
        while (addMe.length) {
          const dirName = addMe.shift();
          next = { id: node.id + '/' + dirName, text: dirName, children: [] };
          node.children.push(next);
          node = next;
        }
        node.children.push({id: node.id + '/' + text, text: text});
      } else {
        // Need to push current root up
        let firstDiff = 0;
        while (rootSegments[firstDiff] === docSegments[firstDiff])
          ++firstDiff;
        if (firstDiff === 0) throw Error('special-case when at root');
        const newRootIdx = firstDiff - 1;

        // Old root now gets a dirname
        VisitedDocs.text = rootSegments[rootSegments.length - 1];
        // walk backwards up the tree
        for (let iAdding = rootSegments.length - 1; iAdding > newRootIdx; --iAdding) {
          const targetSegments = rootSegments.slice(0, iAdding); // CHECK
          renderFrom.pathname = targetSegments.join('/');
          VisitedDocs = {
            id: renderFrom.href,
            text: iAdding === newRootIdx + 1 ? renderFrom.href : rootSegments[iAdding - 1],
            children: [VisitedDocs],
          };
        }
        VisitedTreeRoot = new URL(renderFrom);
        let node = VisitedDocs;
        let next;
        const addMe = docSegments.slice(newRootIdx+1);
        const text = addMe.pop();
        // extend with any remaining addMe (dirs in the docBase)
        while (addMe.length > 0) {
          const dirName = addMe.shift();
          next = { id: node.id + '/' + dirName, text: dirName, children: [] };
          node.children.push(next);
          node = next;
        }
        node.children.push({id: node.id + '/' + text, text: text});
      }
    }
    VisitedTree = new Tree('#visited-tree', {data: [VisitedDocs]}); // Elts.visitedTree
    VisitedTreeIds.add(docBase.href);
  }
  VisitedTree.values = [docBase.href];
}

const InternalLinks = new Map();
const el = (sel, par) => (par||document).querySelector(sel);
let elPopup;

function makeLink (referrer, elementType, turtleElement, parentDomElement) {
  const referrUrl = new URL(referrer);
  const targetUrl = new URL(turtleElement.value);
  const targetUrlStr = targetUrl.href;
  const isNeighbor = referrUrl.protocol === targetUrl.protocol
        && referrUrl.host === targetUrl.host;
  const inDoc = isNeighbor
        && referrUrl.pathname === targetUrl.pathname
        && referrUrl.search === targetUrl.search;
  const element = document.createElement('a');
  element.setAttribute('href', turtleElement.value);
  if (inDoc) {
    element.classList.add("internalOverride");
    let elements = null;
    if (InternalLinks.has(targetUrlStr)) {
      elements = InternalLinks.get(targetUrlStr);
    } else {
      InternalLinks.set(targetUrlStr, (elements = []));
    }
    elements.push(element);

    element.addEventListener('mouseover', async evt => {
      for (const cousin of elements)
        cousin.classList.add("highlighted");
    });
    element.addEventListener('mouseout', async evt => {
      for (const cousin of elements)
        cousin.classList.remove("highlighted");
    });
  } else if (isNeighbor) {
    element.classList.add("neighbor");
    const poList = parentDomElement.parentElement.parentElement.parentElement
    if (poList.classList.contains("predicateObjectList")) {
      const verb = poList.querySelector(".verb");
      if (verb)
        verb.classList.add("has-neighbor");
    }
  } else {
    const title = TurtleJisonContext.exports.origText(turtleElement).join('');
    extensionList.findOwner(targetUrlStr, element, title, popup);
  }
  parentDomElement.append(element);
  element.addEventListener('click', async evt => {
    // evt.stopPropagation();
    if (inDoc) {
      true; // flash elts
    } else if (isNeighbor) {
      const browseUrl = new URL(Interface);
      browseUrl.search = `${BROWSE_PARAM}=${targetUrl.pathname}`;
      history.pushState(null, null, browseUrl);
      renderDoc(targetUrlStr, referrUrl);
      evt.preventDefault();
    } else {
      // allow default to follow link
    }
  });
  // element.addEventListener('click', (event) => event.preventDefault());
  return element;
}

const CssClass_invisible = "invisible";

function popup (element, title, text, definition) {
  element.dataset.popup="#popup-window";

  element.addEventListener('mouseover', async evt => {
    elTarget = element;
    elPopup = Elts.popup;
    elParent = Elts.popup.parentElement;

    // Position:
    const absX = evt.clientX + window.scrollX;
    const absY = evt.clientY + window.scrollY;

    const bcrParent = elParent.getBoundingClientRect();
    const bcrPopup = elPopup.getBoundingClientRect();

    const maxX = bcrParent.width - bcrPopup.width;
    const maxY = bcrParent.height - bcrPopup.height;

    const x = Math.max(0, Math.min(absX, maxX));
    const y = Math.max(0, Math.min(absY, maxY));

    // Show popup
    Object.assign(elPopup.style, {
      left: `${x}px`,
      top: `${y}px`,
    });

    Elts.popupTitle.innerText = title;
    if (definition) { // don't show both label and definition
      Elts.popupLabel.classList.add(CssClass_invisible);
      Elts.popupDefinition.innerText = typeof text === 'function' ? await definition() : definition;
      Elts.popupDefinition.classList.remove(CssClass_invisible);
    } else {
      Elts.popupDefinition.classList.add(CssClass_invisible);
      Elts.popupLabel.innerText = typeof text === 'function' ? await text() : text;
      Elts.popupLabel.classList.remove(CssClass_invisible);
    }

    elPopup.classList.add("is-active");
  });
  element.addEventListener("mouseout", function() {
    // Elts.popup.style.display = "none";
    Elts.popup.classList.remove("is-active");
  });
}

function message (content) {
  const li = document.createElement('li');
  li.append(content);
  Elts.messagesList.append(li);
}
