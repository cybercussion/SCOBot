/*global window, alert, console, HTMLElement, Events */
/*jslint devel: true, browser: true, regexp: true */
/**
 * SCOBot Utilities
 * Module pattern utilized.
 * This is a series of refined util methods previously used via jQuery.
 * Due to the abstraction of the framework/library and cross-browser compatibility this is based on and tested
 * for older browsers.
 *
 * SCOBot previously used :
 * $.extend
 * $.isFunction
 * $().triggerHandler
 * $().on
 * $.isPlainObject
 * $.isWindow
 * $.type
 * class2type
 * $.isArray
 * $().bind
 * $(obj)
 *
 * SCOBot doesn't do any DOM Manipulation, so most of jQuery's appeal is un-needed.
 *
 * That said, not to be over simplified -
 * $(".class")      vs document.querySelectorAll(".class");
 * $("#id .class"); vs document.querySelectorAll("#id .class"); or document.getElementById("id").querySelectorAll(".class");
 *
 * However, SCOBot did use custom events.  Events only fire on DOM objects, so a custom solution was needed.  Regardless
 * of Framework, there are different approaches to this and some are rather extensive.
 *
 * If you are using a framework you may have some overlap and may be able to write some hooks into 'like' functionality
 * without needing this whole file.  Option is totally up to you.  Cost is 3.9KB minified and packed (not gzip compressed).
 *
 * https://github.com/cybercussion/SCOBot
 *
 * @author Cybercussion Interactive, LLC <info@cybercussion.com>
 * @license Copyright (c) 2009-2014, Cybercussion Interactive LLC
 * As of 3.0.0 this code is under a Creative Commons Attribution-ShareAlike 4.0 International License.
 * @version 4.0.0
 * @constructor
 */
/*!
 * SCOBot Utility, Updated July 23rd, 2014
 * Copyright (c) 2009-2013, Cybercussion Interactive LLC. All rights reserved.
 * As of 3.0.0 this code is under a Creative Commons Attribution-ShareAlike 4.0 International License.
 */
var SCOBotUtil = function () {
    // Constructor ///////////////
    "use strict";
    var isReady     = false,
        types       = ["Boolean", "Number", "String", "Function", "Array", "Date", "RegExp", "Object"],
        class_types = [],
        toString    = Object.prototype.toString,
        hasOwn      = Object.prototype.hasOwnProperty,
        eventTypes = {
            load:        'HTMLEvents',
            unload:      'HTMLEvents',
            abort:       'HTMLEvents',
            error:       'HTMLEvents',
            select:      'HTMLEvents',
            change:      'HTMLEvents',
            submit:      'HTMLEvents',
            reset:       'HTMLEvents',
            focus:       'HTMLEvents',
            blur:        'HTMLEvents',
            resize:      'HTMLEvents',
            scroll:      'HTMLEvents',
            input:       'HTMLEvents',

            keyup:       'KeyboardEvent',
            keydown:     'KeyboardEvent',

            click:       'MouseEvents',
            dblclick:    'MouseEvents',
            mousedown:   'MouseEvents',
            mouseup:     'MouseEvents',
            mouseover:   'MouseEvents',
            mousemove:   'MouseEvents',
            mouseout:    'MouseEvents',
            contextmenu: 'MouseEvents'
        },
        defaults = {
            clientX:    0,
            clientY:    0,
            button:     0,
            ctrlKey:    false,
            altKey:     false,
            shiftKey:   false,
            metaKey:    false,
            bubbles:    true,
            cancelable: true,
            view:       document.defaultView,
            key:        '',
            location:   0,
            modifiers:  '',
            repeat:     0,
            locale:     ''
        },
        initializers = {
            HTMLEvents: function (el, name, event, o) {
                return event.initEvent(name, o.bubbles, o.cancelable);
            },
            // Don't need these for SCOBot.
            /*KeyboardEvent: function (el, name, event, o) {
                // Use a blank key if not defined and initialize the charCode
                var key = ('key' in o) ? o.key : "",
                    charCode,
                    modifiers,
                    location = ('location' in o) ? o.location : 0;
                // 0 is the default location
                if (event.initKeyboardEvent) {
                    // Chrome and IE9+ uses initKeyboardEvent
                    if (!'modifiers' in o) {
                        modifiers = [];
                        if (o.ctrlKey) modifiers.push("Ctrl");
                        if (o.altKey) modifiers.push("Alt");
                        if (o.ctrlKey && o.altKey) modifiers.push("AltGraph");
                        if (o.shiftKey) modifiers.push("Shift");
                        if (o.metaKey) modifiers.push("Meta");
                        modifiers = modifiers.join(" ");
                    } else {
                        modifiers = o.modifiers;
                    }

                    return event.initKeyboardEvent(
                        name,
                        o.bubbles,
                        o.cancelable,
                        o.view,
                        key,
                        location,
                        modifiers,
                        o.repeat,
                        o.locale
                    );
                }
                // Mozilla uses initKeyEvent
                charCode = (o.hasOwnProperty('charCode')) ? o.charCode : key.charCodeAt(0) || 0;
                return event.initKeyEvent(
                    name,
                    o.bubbles,
                    o.cancelable,
                    o.view,
                    o.ctrlKey,
                    o.altKey,
                    o.shiftKey,
                    o.metaKey,
                    charCode,
                    key
                );
            },

            MouseEvents: function (el, name, event, o) {
                var screenX = (o.hasOwnProperty('screenX')) ? o.screenX : o.clientX,
                    screenY = (o.hasOwnProperty('screenY')) ? o.screenY : o.clientY,
                    clicks,
                    button;

                if ('detail' in o) {
                    clicks = o.detail;
                } else if (name === 'dblclick') {
                    clicks = 2;
                } else {
                    clicks = 1;
                }

                // Default context menu to be a right click
                if (name === 'contextmenu') {
                    button = button = o.button || 2;
                }

                return event.initMouseEvent(
                    name,
                    o.bubbles,
                    o.cancelable,
                    o.view,
                    clicks,
                    screenX,
                    screenY,
                    o.clientX,
                    o.clientY,
                    o.ctrlKey,
                    o.altKey,
                    o.shiftKey,
                    o.metaKey,
                    button,
                    el
                );
            },*/

            CustomEvent: function (el, name, event, o) {
                return event.initCustomEvent(name, o.bubbles, o.cancelable, o.detail);
            }
        },
        eventSplitter = /\s+/,
        len = types.length,
        self        = this,
        checkLoaded = function (h) {
            if (isReady) {
                return;
            }
            try {
                // If IE is used, use the trick by Diego Perini
                // http://javascript.nwbox.com/IEContentLoaded/
                document.documentElement.doScroll("left");
            } catch (e) {
                setTimeout(function () {
                    checkLoaded(h);
                }, 0);
                return;
            }
            // and execute any waiting functions
            h();
        },
        /**
         * type
         * Private way to check the type null or undefined
         * @param o
         * @returns {String}
         */
        type = function (o) {
            return o == null ? String(o) : class_types[toString.call(o)] || "object";
        },
        /**
         * Is Window
         * @param o
         * @returns {Boolean}
         */
        isWindow = function (o) {
            return o != null && o === o.window; // was o.window which I think is wrong.
        },
        isElement = function (o) {
            return (typeof HTMLElement === "object" ? o instanceof HTMLElement : o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName === "string");
        },
        //////////////////////////////
        // Public ////////////////////
        /**
         * Is Plain Object
         * Will check to see if item passed in is a plain object {}
         * @param o {Object}
         * @returns {Boolean}
         */
        isPlainObject = function (o) {
            if (type(o) !== "object" || o.nodeType || isWindow(o)) {
                return false;
            }
            return !(o.constructor && !hasOwn.call(o.constructor.prototype, "isPrototypeOf"));
        },
        /**
         * Is Array
         * Will check to see if item passed in is an array
         * @param o {Array}
         * @returns {Boolean}
         */
        isArray = function (o) {
            return (o instanceof Array) || (toString.apply(o) === '[object Array]');
        },
        /**
         * Is Function
         * @param o
         * @returns {boolean}
         */
        isFunction = function (o) {
            return type(o) === "function";
        },
        /**
         * Extend
         * @param o {object} range of objects to merge/extend
         * @returns {*|{}}
         */
        extend = function (o) {
            var i = 1,
                args = arguments,
                len = args.length,
                key;
            while (i < len) {
                for (key in args[i]) {
                    if (args[i].hasOwnProperty(key)) {
                        args[0][key] = args[i][key];
                    }
                }
                i += 1;
            }
            return args[0];
        },
        /**
         * Add Event
         * This is tricky because this only works on DOM Objects.
         * @param target
         * @param event
         * @param handler
         */
        addEvent = function (target, event, handler) {
            if (target === window || isElement(target)) {
                // DOM Object
                if (target.addEventListener) {
                    // Standard
                    if (event === "loaded") {
                        event = "DOMContentLoaded";
                    }
                    target.addEventListener(event, handler, false);
                } else {
                    // IE 6/7/8
                    if (event === "loaded") {
                        event = "onreadystatechange";
                        document.attachEvent(event, function () {
                            if (document.readyState === "complete") {
                                document.detachEvent("onreadystatechange", target);
                                isReady = true;
                                handler();
                            }
                        });
                        // If IE and not an iframe
                        if (document.documentElement.doScroll && window === window.top) {
                            checkLoaded(handler);
                        }
                    //} else if (event === "unload") {
                        // We want to ensure we catch IE unload events (still testing)
                    } else {
                        target.attachEvent('on' + event, handler);
                    }
                }
            } else {
                // JavaScript Object
                extend(target, Events); // add capability
                target.on(event, handler); // add listener
            }
        },
        /**
         * Trigger Event
         * @param target
         * @param name
         * @param options
         */
        triggerEvent = function (target, name, options) {
            var doc = document,
                event,
                type,
                attr;
            options = options || {};
            for (attr in defaults) {
                if (!options.hasOwnProperty(attr)) {
                    options[attr] = defaults[attr];
                }
            }
            // Check DOM Element
            if (isWindow(target) || isElement(target)) {
                if (doc.createEvent) {
                    // Standard
                    type = eventTypes[name] || 'CustomEvent';
                    event = doc.createEvent(type);
                    initializers[type](target, name, event, options);
                    try {
                        target.dispatchEvent(event);
                    } catch (e) {
                        // doesn't exist
                    }
                } else {
                    // IE
                    event = doc.createEventObject();
                    target.fireEvent('on' + type, event);
                }
            } else {
                // JavaScript Object
                try {
                    target.trigger(name, options);
                } catch (ee) {
                    // nothing listening
                }
            }
        },
        // End old //////////////////////////////////////
        triggerEvents = function (events, args) {
            var ev,
                i = -1,
                l = events.length,
                a1 = args[0],
                a2 = args[1],
                a3 = args[2],
                al = args.length;
            switch (al) {
            case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
            case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
            case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
            case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
            default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
            }
        },
        eventsApi = function (obj, action, name, rest) {
            if (!name) {
                return true;
            }
            // Handle event maps.
            if (typeof name === 'object') {
                for (var key in name) {
                    obj[action].apply(obj, [key, name[key]].concat(rest));
                }
                return false;
            }
            // Handle space separated event names.
            if (eventSplitter.test(name)) {
                var names = name.split(eventSplitter);
                for (var i = 0, l = names.length; i < l; i++) {
                    obj[action].apply(obj, [names[i]].concat(rest));
                }
                return false;
            }
            return true;
        },
        Events = {
            on: function (name, callback, context) {
                if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
                this._events || (this._events = {});
                var events = this._events[name] || (this._events[name] = []);
                events.push({callback: callback, context: context, ctx: context || this});
                return this;
            },
            once: function (name, callback, context) {
                if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
                var self = this;
                var once = _.once(function() {
                    self.off(name, once);
                    callback.apply(this, arguments);
                });
                once._callback = callback;
                return this.on(name, once, context);
            },
            off: function (name, callback, context) {
                var retain, ev, events, names, i, l, j, k;
                if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
                if (!name && !callback && !context) {
                    this._events = void 0;
                    return this;
                }
                names = name ? [name] : _.keys(this._events);
                for (i = 0, l = names.length; i < l; i++) {
                    name = names[i];
                    if (events = this._events[name]) {
                        this._events[name] = retain = [];
                        if (callback || context) {
                            for (j = 0, k = events.length; j < k; j++) {
                                ev = events[j];
                                if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                                    (context && context !== ev.context)) {
                                    retain.push(ev);
                                }
                            }
                        }
                        if (!retain.length) delete this._events[name];
                    }
                }
                return this;
            },
            trigger: function (name, options) {
                var args = [options],
                    events,
                    allEvents;
                if (!this._events) {
                    return this;
                }
                if (!eventsApi(this, 'trigger', name, args)) {
                    return this;
                }
                events = this._events[name];
                allEvents = this._events.all;
                if (events) {
                    triggerEvents(events, args);
                }
                if (allEvents) {
                    triggerEvents(allEvents, args);
                }
                return this;
            },
            stopListening: function (obj, name, callback) {
                var listeningTo = this._listeningTo;
                if (!listeningTo) return this;
                var remove = !name && !callback;
                if (!callback && typeof name === 'object') callback = this;
                if (obj) (listeningTo = {})[obj._listenId] = obj;
                for (var id in listeningTo) {
                    obj = listeningTo[id];
                    obj.off(name, callback, this);
                    if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
                }
                return this;
            }
        };

    // Build class types
    while (len--) {
        var t = types[len];
        class_types["[object " + t + "]"] = t.toLowerCase();
    }

    // Public Object
    return {
        isWindow: isWindow,
        type: type,
        extend: extend,
        isPlainObject: isPlainObject,
        isArray: isArray,
        isFunction: isFunction,
        addEvent: addEvent,
        triggerEvent: triggerEvent,
        Events: Events
    };
    //////////////////////////////
}();