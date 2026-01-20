/**
 * SCOBot Utilities
 * Modernized for ES6+ (2026)
 *
 * @author Cybercussion Interactive, LLC
 * @license CC-BY-SA-4.0
 */

const types = ["Boolean", "Number", "String", "Function", "Array", "Date", "RegExp", "Object"];
const class_types = {};
types.forEach(t => {
    class_types[`[object ${t}]`] = t.toLowerCase();
});

const eventSplitter = /\s+/;

/**
 * Events Mixin
 * Provides backbone-style event handling (on, off, trigger, once)
 */
export const Events = {
    on(name, callback, context) {
        if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
        this._events || (this._events = {});
        const events = this._events[name] || (this._events[name] = []);
        events.push({ callback, context, ctx: context || this });
        return this;
    },

    once(name, callback, context) {
        if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
        const self = this;
        const once = function (...args) {
            self.off(name, once);
            callback.apply(this, args);
        };
        once._callback = callback;
        return this.on(name, once, context);
    },

    off(name, callback, context) {
        if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
        if (!name && !callback && !context) {
            this._events = void 0;
            return this;
        }
        const names = name ? [name] : Object.keys(this._events);
        for (let i = 0, l = names.length; i < l; i++) {
            name = names[i];
            const events = this._events[name];
            if (events) {
                const retain = [];
                if (callback || context) {
                    for (let j = 0, k = events.length; j < k; j++) {
                        const ev = events[j];
                        if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                            (context && context !== ev.context)) {
                            retain.push(ev);
                        }
                    }
                }
                if (retain.length) {
                    this._events[name] = retain;
                } else {
                    delete this._events[name];
                }
            }
        }
        return this;
    },

    trigger(name, ...args) {
        if (!this._events) return this;
        if (!eventsApi(this, 'trigger', name, args)) return this;
        const events = this._events[name];
        const allEvents = this._events.all;
        if (events) triggerEvents(events, args);
        if (allEvents) triggerEvents(allEvents, args);
        return this;
    }
};

// Private helpers for Events
function triggerEvents(events, args) {
    let i = -1;
    const l = events.length;
    while (++i < l) {
        const ev = events[i];
        ev.callback.apply(ev.ctx, args);
    }
}

function eventsApi(obj, action, name, rest) {
    if (!name) return true;
    if (typeof name === 'object') {
        for (const key in name) {
            obj[action].apply(obj, [key, name[key]].concat(rest));
        }
        return false;
    }
    if (eventSplitter.test(name)) {
        const names = name.split(eventSplitter);
        for (const n of names) {
            obj[action].apply(obj, [n].concat(rest));
        }
        return false;
    }
    return true;
}

export default class SCOBotUtil {

    static Events = Events;

    static type(o) {
        return o == null ? String(o) : class_types[Object.prototype.toString.call(o)] || "object";
    }

    static isWindow(o) {
        return o != null && o === o.window;
    }

    static isElement(o) {
        return (typeof HTMLElement === "object" ? o instanceof HTMLElement : o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName === "string");
    }

    static isPlainObject(o) {
        if (SCOBotUtil.type(o) !== "object" || o.nodeType || SCOBotUtil.isWindow(o)) {
            return false;
        }
        return !(o.constructor && !Object.prototype.hasOwnProperty.call(o.constructor.prototype, "isPrototypeOf"));
    }

    static isArray(o) {
        return Array.isArray(o);
    }

    static isFunction(o) {
        return typeof o === "function";
    }

    /**
     * Extend object
     * @param {Object} target 
     * @param  {...Object} sources 
     */
    static extend(target, ...sources) {
        return Object.assign(target, ...sources);
    }

    /**
     * Cross-browser addEventListener (Modernized, dropping IE8 support)
     */
    static addEvent(target, event, handler) {
        if (event.indexOf(' ') >= 0) {
            const events = event.split(' ');
            events.forEach(e => SCOBotUtil.addEvent(target, e, handler));
            return;
        }

        if (target === window || SCOBotUtil.isElement(target)) {
            if (event === "loaded") event = "DOMContentLoaded";
            target.addEventListener(event, handler, false);
        } else {
            // JS Object Event mixin
            SCOBotUtil.extend(target, Events);
            target.on(event, handler);
        }
    }

    static triggerEvent(target, name, options = {}) {
        const defaults = {
            bubbles: true,
            cancelable: true,
            detail: options
        };
        const settings = { ...defaults, ...options };

        if (SCOBotUtil.isWindow(target) || SCOBotUtil.isElement(target)) {
            const event = new CustomEvent(name, settings);
            target.dispatchEvent(event);
        } else {
            if (target.trigger) {
                target.trigger(name, options);
            }
        }
    }

    static calcAverage(num_arr) {
        if (!num_arr.length) return "0.00";
        const sum = num_arr.reduce((acc, curr) => acc + (curr.lat || 0), 0);
        return (sum / num_arr.length).toFixed(2);
    }
}