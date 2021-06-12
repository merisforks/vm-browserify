var indexOf = require('indexof');

var unnecessary = ["postMessage","blur","focus","close","frames","self","window","parent","opener","top",
"length","closed","location","document","origin","name","history","locationbar","menubar","personalbar",
"scrollbars","statusbar","toolbar","status","frameElement","navigator","customElements","external","screen","innerWidth",
"innerHeight","scrollX","pageXOffset","scrollY","pageYOffset","screenX","screenY","outerWidth","outerHeight","devicePixelRatio",
"clientInformation","screenLeft","screenTop","defaultStatus","defaultstatus","styleMedia","onanimationend","onanimationiteration","onanimationstart","onsearch",
"ontransitionend","onwebkitanimationend","onwebkitanimationiteration","onwebkitanimationstart","onwebkittransitionend","isSecureContext","onabort","onblur","oncancel","oncanplay",
"oncanplaythrough","onchange","onclick","onclose","oncontextmenu","oncuechange","ondblclick","ondrag","ondragend","ondragenter",
"ondragleave","ondragover","ondragstart","ondrop","ondurationchange","onemptied","onended","onerror","onfocus","oninput",
"oninvalid","onkeydown","onkeypress","onkeyup","onload","onloadeddata","onloadedmetadata","onloadstart","onmousedown","onmouseenter",
"onmouseleave","onmousemove","onmouseout","onmouseover","onmouseup","onmousewheel","onpause","onplay","onplaying","onprogress",
"onratechange","onreset","onresize","onscroll","onseeked","onseeking","onselect","onstalled","onsubmit","onsuspend",
"ontimeupdate","ontoggle","onvolumechange","onwaiting","onwheel","onauxclick","ongotpointercapture","onlostpointercapture","onpointerdown","onpointermove",
"onpointerup","onpointercancel","onpointerover","onpointerout","onpointerenter","onpointerleave","onafterprint","onbeforeprint","onbeforeunload","onhashchange",
"onlanguagechange","onmessage","onmessageerror","onoffline","ononline","onpagehide","onpageshow","onpopstate","onrejectionhandled","onstorage",
"onunhandledrejection","onunload","performance","stop","open","alert","confirm","prompt","print","requestAnimationFrame",
"cancelAnimationFrame","requestIdleCallback","cancelIdleCallback","captureEvents","releaseEvents","getComputedStyle","matchMedia","moveTo","moveBy","resizeTo",
"resizeBy","getSelection","find","webkitRequestAnimationFrame","webkitCancelAnimationFrame","fetch","btoa","atob","setTimeout","clearTimeout",
"setInterval","clearInterval","createImageBitmap","scroll","scrollTo","scrollBy","onappinstalled","onbeforeinstallprompt","ondevicemotion",
"ondeviceorientation","ondeviceorientationabsolute","indexedDB","webkitStorageInfo","sessionStorage","localStorage","chrome","visualViewport","speechSynthesis","webkitRequestFileSystem",
"webkitResolveLocalFileSystemURL","openDatabase","applicationCache","caches"]

// cached iFrame instance, re-use for each runInContext Call.
var cache = {
  'iFrame': null,
  'context': {},
  'cKeys': [],
  'winOriginal': []
};

var Object_keys = function (obj) {
    if (Object.keys) return Object.keys(obj)
    else {
        var res = [];
        for (var key in obj) res.push(key)
        return res;
    }
};

var forEach = function (xs, fn) {
    if (xs.forEach) return xs.forEach(fn)
    else for (var i = 0; i < xs.length; i++) {
        fn(xs[i], i, xs);
    }
};

var defineProp = (function() {
    try {
        Object.defineProperty({}, '_', {});
        return function(obj, name, value) {
            Object.defineProperty(obj, name, {
                writable: true,
                enumerable: false,
                configurable: true,
                value: value
            })
        };
    } catch(e) {
        return function(obj, name, value) {
            obj[name] = value;
        };
    }
}());

var globals = ['Array', 'Boolean', 'Date', 'Error', 'EvalError', 'Function',
'Infinity', 'JSON', 'Math', 'NaN', 'Number', 'Object', 'RangeError',
'ReferenceError', 'RegExp', 'String', 'SyntaxError', 'TypeError', 'URIError',
'decodeURI', 'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'escape',
'eval', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'undefined', 'unescape'];

function Context() {}
Context.prototype = {};

var Script = exports.Script = function NodeScript (code) {
    if (!(this instanceof Script)) return new Script(code);
    if(!cache.iFrame) {
      cache.iFrame = document.createElement('iframe');
      if (!cache.iFrame.style) cache.iFrame.style = {};
      cache.iFrame.style.display = 'none';
      cache.iFrame.setAttribute('sandbox', 'allow-same-origin');

      document.body.appendChild(cache.iFrame);
      var w = cache.iFrame.contentWindow;
      // delete all unnecessary keys in the window
      forEach(unnecessary, function (key) {
        delete w[key];
      });
      cache.winOriginal = Object_keys(w);

    // mix in the context keys
    var win = cache.iFrame.contentWindow;
    forEach(cache.cKeys, function (key) {
      win[key] = cache.context[key];
      if(indexOf(cache.winOriginal, key) === -1) cache.winOriginal.push(key);
    });
    }


    this.code = code;
    this.iFrame = cache.iFrame;
    this.winOriginal = cache.winOriginal;
};

Script.prototype.runInContext = function (context) {
    if (!(context instanceof Context)) {
        throw new TypeError("needs a 'context' argument.");
    }
    var win = this.iFrame.contentWindow;
    var winOriginal = this.winOriginal;
    let originalToRestore = {};
    var wEval = win.eval, wExecScript = win.execScript;

    forEach(Object_keys(context), function (key) {
      if(win[key] !== undefined) {
        originalToRestore[key] = win[key];
      }
      win[key] = context[key];
    });

    if (!wEval && wExecScript) {
      // win.eval() magically appears when this is called in IE:
      wExecScript.call(win, 'null');
      wEval = win.eval;
  }
  
    
    var winKeys = Object_keys(win);

    var res = wEval.call(win, this.code);

    forEach(Object_keys(win), function (key) {
        // Avoid copying circular objects like `top` and `window` by only
        // updating existing context properties or new properties in the `win`
        // that was only introduced after the eval.
        if (key in context || indexOf(winKeys, key) === -1) {
            if (indexOf(globals, key) === -1) context[key] = win[key];
            else defineProp(context, key, win[key]);
        }
        // delete win context of extra fields
        if (indexOf(winOriginal, key) === -1) delete win[key];
    });

    // restore context to original field values
    forEach(Object_keys(originalToRestore), function (key) {
      win[key] = originalToRestore[key];
    });

    return res;
};

Script.prototype.runInThisContext = function () {
    return eval(this.code); // maybe...
};

Script.prototype.runInNewContext = function (context) {
    var ctx = Script.createContext(context);
    var res = this.runInContext(ctx);

    forEach(Object_keys(ctx), function (key) {
        context[key] = ctx[key];
    });

    return res;
};

forEach(Object_keys(Script.prototype), function (name) {
    exports[name] = Script[name] = function (code) {
        var s = Script(code);
        return s[name].apply(s, [].slice.call(arguments, 1));
    };
});

exports.createScript = function (code) {
    return exports.Script(code);
};

exports.createContext = Script.createContext = function (context) {
    var copy = new Context();
    if(typeof context === 'object') {
        forEach(Object_keys(context), function (key) {
            copy[key] = context[key];
        });
    }
    return copy;
};

exports.importContext = function (context) {
  // add context to the iFrame context
  cache.context = Object.assign({}, cache.context, context);
  cache.cKeys = Object_keys(cache.context);
  // if this is a context that is bound after the cache has been created
  // then update the execution window with the new context
  // and update the winOriginal cache
  var win = cache.iFrame && cache.iFrame.contentWindow;
  if(win) {
    forEach(Object_keys(context), function (key) {
      win[key] = cache.context[key];
      if(indexOf(cache.winOriginal, key) === -1) cache.winOriginal.push(key);
    });
  }
};
