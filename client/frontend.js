
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
let this_Interface = null;
let this_VisitedDocs = null;
let this_VisitedTreeRoot = null;
const this_VisitedTreeIds = new Set();
let this_VisitedTree = null;

const this_Elts = {
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
//  this_VisitedTree = new Tree('#visited-tree', {data: [this_VisitedDocs]});
}

function log (className, msg) {
  const li = document.createElement('li');
  li.className = className;
  li.innerText = msg;
  document.querySelector('#messages').prepend(li);
}

async function onLoad (evt) {
  this_Elts.pageInput.oninput = inputDoc;
  this_Interface = new URL(location);
  this_Interface.search = this_Interface.hash = '';
  const params = new URLSearchParams(location.search);
  const docUrlStr = params.get(BROWSE_PARAM);
  if (docUrlStr) {
    this_Elts.pageInput.value = docUrlStr;
    inputDoc.call(this_Elts.pageInput, evt);
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

  // message(`-> ${new URL(urlStr, oldBase).href}`);
  this_Elts.renderElement.replaceChildren(); // clear out rendering area

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
  }).render(parseTree, this_Elts.renderElement);

  document.title = urlStr;

  if (!this_VisitedTreeIds.has(docBase.href)) {
    let text = null;
    const targetSegments = docBase.pathname.split('/').slice(1); // skip leading empty segment
    const renderFrom = new URL('/', docBase);
    if (this_VisitedTreeRoot === null) {
      // First entry rendered so no root
      text = targetSegments.pop();
      renderFrom.pathname = targetSegments.join('/');
      this_VisitedTreeRoot = new URL(renderFrom);
      this_VisitedDocs = {
        id: renderFrom.href,
        text: renderFrom.href,
        children: [{
          id: docBase.href,
          text: text,
        }]
      };
    } else {
      const rootSegments = this_VisitedTreeRoot.pathname.split('/').slice(1); // skip leading empty segment
      const docSegments = docBase.pathname.split('/').slice(1);
      if (docBase.href.startsWith(this_VisitedTreeRoot.href)) {
        // Fits underneath current root
        const addMe = docSegments.slice(rootSegments.length);
        text = addMe.pop();
        let node = this_VisitedDocs;
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
        this_VisitedDocs.text = rootSegments[rootSegments.length - 1];
        // walk backwards up the tree
        for (let iAdding = rootSegments.length - 1; iAdding > newRootIdx; --iAdding) {
          const targetSegments = rootSegments.slice(0, iAdding); // CHECK
          renderFrom.pathname = targetSegments.join('/');
          this_VisitedDocs = {
            id: renderFrom.href,
            text: iAdding === newRootIdx + 1 ? renderFrom.href : rootSegments[iAdding - 1],
            children: [this_VisitedDocs],
          };
        }
        this_VisitedTreeRoot = new URL(renderFrom);
        let node = this_VisitedDocs;
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
    this_VisitedTree = new Tree('#visited-tree', {data: [this_VisitedDocs]}); // this_Elts.visitedTree
    this_VisitedTreeIds.add(docBase.href);
  }
  this_VisitedTree.values = [docBase.href];
}

const this_InternalLinks = new Map();
let elPopup;

function makeLink (referrer, elementType, turtleElement, parentDomElement) {
  const referrUrl = new URL(referrer);
  const targetUrl = new URL(turtleElement.value);
  const targetUrlStr = targetUrl.href;
  const isNeighbor = referrUrl.protocol === targetUrl.protocol
        && referrUrl.host === targetUrl.host;
  const isSameDoc = isNeighbor
        && referrUrl.pathname === targetUrl.pathname
        && referrUrl.search === targetUrl.search;
  const element = document.createElement('a');
  element.setAttribute('href', turtleElement.value);
  if (isSameDoc) {
    element.classList.add("internalOverride");
    let elements = null;
    if (this_InternalLinks.has(targetUrlStr)) {
      elements = this_InternalLinks.get(targetUrlStr);
    } else {
      this_InternalLinks.set(targetUrlStr, (elements = []));
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
    testLink(targetUrl, element); // no reason to await this
  } else {
    const title = TurtleJisonContext.exports.origText(turtleElement).join('');
    extensionList.findOwner(targetUrlStr, element, title, popup);
  }
  parentDomElement.append(element);
  element.addEventListener('click', async evt => {
    // evt.stopPropagation();
    if (isSameDoc) {

      // find next element referring to the same target
      const siblings = [...document.querySelectorAll(`[href="${evt.target.href}"]`)];
      let idx = siblings.indexOf(element);
      if (++idx > siblings.length -1) idx = 0;

      // scroll to see next sibling
      focusOn(siblings[idx]);

      // flash that sibling to draw attention to it
      siblings.forEach(elt => flash(elt));
      evt.preventDefault();
    } else if (isNeighbor) {
      const browseUrl = new URL(this_Interface);
      browseUrl.search = `${BROWSE_PARAM}=${targetUrl.pathname}`;
      history.pushState(null, null, browseUrl);
      renderDoc(targetUrlStr, referrUrl).catch(e => {
        const pre = document.createElement('pre');
        pre.innerText = e.message;
        this_Elts.renderElement.replaceChildren(pre);
      });
      evt.preventDefault();
    } else {
      // allow default to follow link
    }
  });
  // element.addEventListener('click', (event) => event.preventDefault());
  return element;
}

async function testLink (targetUrl, element) {
  try {
    const resp = await fetch(targetUrl, {headers: {redirect: 'follow', accept: 'text/turtle'} });
    const body = await resp.text();
    if (!resp.ok) {
      element.classList.add('error');
      element.title = body;
    } else {
      const ct = resp.headers.get('content-type');
      if (!ct) {
        element.classList.add('warning');
        element.title = `no Content-Type`;
      } else if (!ct.startsWith('text/turtle')) {
        element.classList.add('warning');
        element.title = `can't use Content-Type ${ct}`;
      }
    }
  } catch (e) {
    element.classList.add('error');
    element.title = e.message;
  }
}

function focusOn (domElement) {
  domElement.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
}

function flash (domElement) {
  const origBackground = domElement.style.backgroundColor;
  domElement.style.backgroundColor = "#fc9";
  setTimeout(() => {
    domElement.style.backgroundColor = origBackground;
    setTimeout(() => {
      domElement.style.backgroundColor = "#fc9";
      setTimeout(() => {
        domElement.style.backgroundColor = origBackground;
      }, 200);
    }, 250);
  }, 300);
}

const CssClass_invisible = "invisible";

function popup (element, title, text, definition) {
  element.dataset.popup="#popup-window";

  element.addEventListener('mouseover', async evt => {
    const elTarget = element;
    elPopup = this_Elts.popup;
    const elParent = this_Elts.popup.parentElement;

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

    this_Elts.popupTitle.innerText = title;
    if (definition) { // don't show both label and definition
      this_Elts.popupLabel.classList.add(CssClass_invisible);
      this_Elts.popupDefinition.innerText = typeof text === 'function' ? await definition() : definition;
      this_Elts.popupDefinition.classList.remove(CssClass_invisible);
    } else {
      this_Elts.popupDefinition.classList.add(CssClass_invisible);
      this_Elts.popupLabel.innerText = typeof text === 'function' ? await text() : text;
      this_Elts.popupLabel.classList.remove(CssClass_invisible);
    }

    elPopup.classList.add("is-active");
  });
  element.addEventListener("mouseout", function() {
    // this_Elts.popup.style.display = "none";
    this_Elts.popup.classList.remove("is-active");
  });
}

function message (content) {
  const li = document.createElement('li');
  li.append(content);
  this_Elts.messagesList.append(li);
}
