
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

class HttpError extends Error {
  constructor (urlStr, status, body, verb = 'GET') {
    super(`${verb} <${urlStr}> got ${status}`);
    this.verb = verb;
    this.urlStr = urlStr;
    this.status = status;
    this.body = body;
  }
}

const SHORTEN_PARAM = 'shorten';
const BROWSE_PARAM = 'browse';
const CssClass_invisible = "invisible";

class MyRenderClickable extends RenderClickableLd {

  constructor (dom, docBase, frontend, makeLink) {
    super(dom, {
      sparqlPrefix: {useParent: true},
      skipped: {useParent: true},
      namespace: {useParent: true},
      statementOrWs: {useParent: true},
      BuiltInDatatype: {useParent: true},

      pname: { construct: makeLink },
      relativeUrl: { construct: makeLink },
      BLANK_NODE_LABEL: { className: "bnode" },
      ANON: { className: "bnode" },
      // blankNodePropertyList: { className: "blankNodePropertyList123" },
      "blankNodePropertyList/start": { className: "bnode" },
      "blankNodePropertyList/end": { className: "bnode" },
      collection: { className: "bnode" },
      simpleLiteral: { className: "literal" },
      datatypedLiteral: { className: "literal" },
      langTagLiteral: { className: "literal" },
    });
    this.docBase = docBase;
    this.frontend = frontend;
  }

  renderRelativeUrl (relativeUrl, element) {
    if (!this.frontend.shorten)
      return super.renderRelativeUrl(relativeUrl, element);

    const ret = this.span("relativeUrl", relativeUrl, element);
    const calculated = '<' + RelativizeUrl.relativize(relativeUrl.value, this.docBase.href) + '>';
    ret.innerText = calculated.length < relativeUrl.origText.length
      ? calculated
      : relativeUrl.origText;
    return ret;
  }
}

class FrontEnd {
  constructor () {
    this.Interface = null;
    this.VisitedDocs = null;
    this.VisitedTreeRoot = null;
    this.VisitedTreeIds = new Set();
    this.VisitedTree = null;
    this.InternalLinks = new Map();
    this.quads = null;

    this.Elts = {
      pageInput: document.querySelector('#page input'),
      renderElement: document.querySelector('.clickable'),
      lastError: document.querySelector('#last-error'),
      messagesList: document.querySelector('#messages ol'),
      popup: document.querySelector('#popup-window'),
      popupTitle: document.querySelector('#popup-window h3'),
      popupLabel: document.querySelector('#popup-window .label'),
      popupDefinition: document.querySelector('#popup-window .definition'),
      referrer: document.querySelector('#referrer'),
      visitedTree: document.querySelector('#visited-tree'),
    };

    // window.addEventListener("load", onLoad);
    document.addEventListener("DOMContentLoaded", this.onLoad.bind(this));
    window.addEventListener("popstate", this.popState.bind(this));

    this.fetchWorkerReady = new Promise((resolve, reject) => {
      window.addEventListener("fetchworkerready", readyEvent => resolve(readyEvent));
    });

    navigator.serviceWorker.register("fetchworker.js").then(
      _=> navigator.serviceWorker.controller
        ? window.dispatchEvent(new CustomEvent("fetchworkerready")) // normal reload
        : navigator.serviceWorker.ready.then(_=> location.reload()) // first load or Ctrl+F5
    );
  }

  async popState (evt) {
    this.onLoad(evt);
    //  this.VisitedTree = new Tree('#visited-tree', {data: [this.VisitedDocs]});
  }

  log (className, msg) {
    const li = document.createElement('li');
    li.className = className;
    li.innerText = msg;
    document.querySelector('#messages').prepend(li);
  }

  async  onLoad (evt) {
    await this.fetchWorkerReady;
    const _FrontEnd = this;
    async function inputDoc (evt) {
      if (evt.target.value)
        _FrontEnd.renderDoc(this.value, new URL(document.location)).catch(e => _FrontEnd.showError(e));
    }

    this.Elts.pageInput.onblur = inputDoc;
    this.Elts.pageInput.addEventListener("keypress", function(evt) {
      if (evt.key === "Enter") {
        if (evt.target.value)
          _FrontEnd.renderDoc(this.value, new URL(document.location)).catch(e => _FrontEnd.showError(e));
        // evt.preventDefault();
      }
    });
    this.Interface = new URL(location);
    this.Interface.search = this.Interface.hash = '';
    const params = new URLSearchParams(location.search);
    const shorten = params.get(SHORTEN_PARAM);
    this.shorten = shorten && ['', 'false', '0', 'no'].indexOf(shorten) === -1;
    const docUrlStr = params.get(BROWSE_PARAM);
    if (docUrlStr) {
      this.Elts.pageInput.value = docUrlStr;
      this.renderDoc(docUrlStr, new URL(document.location)).catch(e => this.showError(e));
    }
  }

  async renderDoc (urlStr, oldBase) {
    const docBase = new URL(urlStr, oldBase);
    const resp = await fetch(docBase);
    const body = await resp.text();
    if (!resp.ok)
      throw new HttpError(urlStr, resp.status, body);

    this.Elts.referrer.href = docBase;

    // this.message(`-> ${new URL(urlStr, oldBase).href}`);
    this.Elts.renderElement.replaceChildren(); // clear out rendering area
    this.Elts.lastError.style.display = 'none'; // make sure we're looking at the rendered Turtle
    this.Elts.renderElement.style.display = '';

    const contentType = resp.headers.get("Content-Type");
    if (contentType && contentType !== 'text/turtle')
      throw Error(`media type ${contentType} not supported; only "text/turtle" for now`);

    const parser = new TurtleParser.TurtleParser({baseIRI: docBase.href, factory: new DataFactory()});
    const parseTree = parser.parse(body);
    this.quads = [...parser.getQuads()];

    await extensionList.ready();
    new MyRenderClickable(document, docBase, this, this.makeLink.bind(this, docBase)).render(parseTree, this.Elts.renderElement);

    document.title = urlStr;

    if (!this.VisitedTreeIds.has(docBase.href)) {
      let text = null;
      const targetSegments = docBase.pathname.split('/').slice(1); // skip leading empty segment
      const renderFrom = new URL('/', docBase);
      if (this.VisitedTreeRoot === null) {
        // First entry rendered so no root
        text = targetSegments.pop();
        renderFrom.pathname = targetSegments.join('/');
        this.VisitedTreeRoot = new URL(renderFrom);
        this.VisitedDocs = {
          id: renderFrom.href,
          text: renderFrom.href,
          children: [{
            id: docBase.href,
            text: text,
          }]
        };
      } else {
        const rootSegments = this.VisitedTreeRoot.pathname.split('/').slice(1); // skip leading empty segment
        const docSegments = docBase.pathname.split('/').slice(1);
        if (docBase.href.startsWith(this.VisitedTreeRoot.href)) {
          // Fits underneath current root
          const addMe = docSegments.slice(rootSegments.length);
          text = addMe.pop();
          let node = this.VisitedDocs;
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
          if (firstDiff === 0) throw Error('special-case when at root -- please reproduce this behavior and describe that in a detailed bug repot ');
          const newRootIdx = firstDiff - 1;

          // Old root now gets a dirname
          this.VisitedDocs.text = rootSegments[rootSegments.length - 1];
          // walk backwards up the tree
          for (let iAdding = rootSegments.length - 1; iAdding > newRootIdx; --iAdding) {
            const targetSegments = rootSegments.slice(0, iAdding); // CHECK
            renderFrom.pathname = targetSegments.join('/');
            this.VisitedDocs = {
              id: renderFrom.href,
              text: iAdding === newRootIdx + 1 ? renderFrom.href : rootSegments[iAdding - 1],
              children: [this.VisitedDocs],
            };
          }
          this.VisitedTreeRoot = new URL(renderFrom);
          let node = this.VisitedDocs;
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
      this.VisitedTree = new Tree('#visited-tree', {data: [this.VisitedDocs]}); // this.Elts.visitedTree
      this.VisitedTreeIds.add(docBase.href);
    }
    this.VisitedTree.values = [docBase.href];
  }

  makeLink (referrer, elementType, turtleElement, parentDomElement) {
    const referrUrl = new URL(referrer);
    const targetUrl = new URL(turtleElement.value);
    const targetUrlStr = targetUrl.href;
    const describedInThisDoc = this.quads.find(q => q.subject.value === targetUrlStr);
    const isNeighbor = referrUrl.protocol === targetUrl.protocol
          && referrUrl.host === targetUrl.host;
    const isSameDoc = isNeighbor
          && referrUrl.pathname === targetUrl.pathname
          && referrUrl.search === targetUrl.search;
    const element = document.createElement('a');
    element.setAttribute('href', turtleElement.value);
    if (isSameDoc || describedInThisDoc) {
      element.classList.add("internalOverride");
      let elements = null;
      if (this.InternalLinks.has(targetUrlStr)) {
        elements = this.InternalLinks.get(targetUrlStr);
      } else {
        this.InternalLinks.set(targetUrlStr, (elements = []));
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
      if (!isSameDoc)
        this.testLink(targetUrl, element, 'warning'); // no reason to await this
    } else if (isNeighbor) {
      element.classList.add("neighbor");
      const poList = parentDomElement.parentElement.parentElement.parentElement
      if (poList.classList.contains("predicateObjectList")) {
        const verb = poList.querySelector(".verb");
        if (verb)
          verb.classList.add("has-neighbor");
      }
      this.testLink(targetUrl, element, 'error'); // no reason to await this
    } else {
      const title = TurtleJisonContext.exports.origText(turtleElement).join('');
      const x = extensionList.findOwner(targetUrlStr, element, title, this.popup.bind(this));
      if (!x) {
        element.addEventListener('mouseover', async evt => {
          const popupWindow = window.open(targetUrlStr, 'Some Title?', 'width=800,height=400')
          if (popupWindow) {
            // popupWindow.focus();
            popupWindow.moveTo(evt.pageX, evt.pageY);
            popupWindow.addEventListener('mouseout', async evt => {
              popupWindow.close();
            });
          }
        });

        element.setAttribute('target', "_blank");
      }
    }
    parentDomElement.append(element);
    element.addEventListener('click', async evt => {
      // evt.stopPropagation();
      if (isSameDoc || describedInThisDoc) {

        // find next element referring to the same target
        const siblings = [...document.querySelectorAll(`[href="${evt.target.href}"]`)];
        let idx = siblings.indexOf(element);
        if (++idx > siblings.length -1) idx = 0;

        // scroll to see next sibling
        this.focusOn(siblings[idx]);

        // flash that sibling to draw attention to it
        siblings.forEach(elt => this.flash(elt));
        evt.preventDefault();
      } else if (isNeighbor) {
        const browseUrl = new URL(this.Interface);
        const shortenStr = this.shorten ? `${SHORTEN_PARAM}=true&` : '';
        browseUrl.search = `${shortenStr}${BROWSE_PARAM}=${targetUrl.pathname}`;
        history.pushState(null, null, browseUrl);
        this.renderDoc(targetUrlStr, referrUrl).catch(e => this.showError(e));
        evt.preventDefault();
      } else {
        // allow default to follow link
      }
    });
    // element.addEventListener('click', (event) => event.preventDefault());
    return element;
  }

  showError (err) {
    this.Elts.lastError.style.display = '';
    this.Elts.renderElement.style.display = 'none';
    if (err instanceof HttpError) {
      this.Elts.lastError.querySelector('pre').innerText = err.message;
      this.Elts.lastError.querySelector('div').innerHTML = err.body;
    } else {
      this.Elts.lastError.querySelector('pre').innerText = err;
    }
  }

  async testLink (targetUrl, element, code4xx) {
    try {
      const resp = await fetch(targetUrl, {headers: {redirect: 'follow', accept: 'text/turtle'} });
      const body = await resp.text();
      const status = resp.headers.get('X-Status') || resp.status;
      if (status >= 400) {
        // console.log([[targetUrl.href, status], ...resp.headers.entries()]);
        if (targetUrl.href === 'https://w3id.org/ejp-rd/fairdatapoints/wp13/distribution/2f833bc7-9f14-4c96-b181-664b37c7a015/metrics/445c0a70d1e214e545b261559e2842f4') console.log('HERE', code4xx);
        element.classList.add(code4xx);
        element.title = `GET got ${status}`;
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
      element.classList.add(code4xx);
      element.title = e.message;
    }
  }

  focusOn (domElement) {
    domElement.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
  }

  flash (domElement) {
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

  popup (element, title, text, definition) {
    element.dataset.popup="#popup-window";

    element.addEventListener('mouseover', async evt => {
      const elTarget = element;
      const elPopup = this.Elts.popup;
      const elParent = this.Elts.popup.parentElement;

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

      this.Elts.popupTitle.innerText = title;
      if (definition) { // don't show both label and definition
        this.Elts.popupLabel.classList.add(CssClass_invisible);
        this.Elts.popupDefinition.innerText = typeof text === 'function' ? await definition() : definition;
        this.Elts.popupDefinition.classList.remove(CssClass_invisible);
      } else {
        this.Elts.popupDefinition.classList.add(CssClass_invisible);
        this.Elts.popupLabel.innerText = typeof text === 'function' ? await text() : text;
        this.Elts.popupLabel.classList.remove(CssClass_invisible);
      }

      elPopup.classList.add("is-active");
    });
    element.addEventListener("mouseout", () => {
      // this.Elts.popup.style.display = "none";
      this.Elts.popup.classList.remove("is-active");
    });
  }

  message (content) {
    const li = document.createElement('li');
    li.append(content);
    this.Elts.messagesList.append(li);
  }
}

new FrontEnd();
