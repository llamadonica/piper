import guid from './guid.js';

// These are the proxy classes that connect to the 
const windowId = window['__windowId__'];

class Completer {
  constructor() {
    this.status = {};
    this.resolve = (val) => {
      if (this.status.state) {
        throw "completer can't resolve twice";
      }
      this.status.state = 'resolved';
      this.status.value = val;
    }
    this.reject = (err) => {
      if (this.status.state) {
        throw "completer can't resolve twice";
      }
      this.status.state = 'rejected';
      this.status.value = err;
    }
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      if (this.status.state == 'resolved') {
        resolve(this.status.value)
      } else if (this.status.state == 'rejected') {
        reject(this.status.value);
      }
    });
  }
}

class MessageMaster {
  constructor() {
    this._connectedCallbacks = new Map();
    this._connectedMessageHooks = new Map();
    this._callbackFunction = this.__callbackFunction.bind(this);
    chrome.runtime.onMessage.addListener(this._callbackFunction);
  }
  __callbackFunction(ev) {
    console.log('receiving', ev);
    if (ev.target !== windowId) return;
    if (ev.messageType === 'reply' ) {
      let callbackFn = this._connectedCallbacks.get(ev.handle);
      if (!callbackFn) {
        console.error('response hook was not found or disconnected', ev);
        return;
      }
      this._connectedCallbacks.delete(ev.handle);
      callbackFn(ev);
      return;
    } else if (ev.messageType === 'event') {
      let callbackFn = this._connectedMessageHooks.get(ev.streamHandle);
      if (!callbackFn) {
        console.error('response hook was not found or disconnected', ev);
        return;
      }
      callbackFn(ev);
      return;
    }
    console.error('Message was not understood');
  }
  _addCallback(guid, fn) {
    this._connectedCallbacks.set(guid, fn);
  }
  _addEventCallback(guid, fn) {
    this._connectedMessageHooks.set(guid, fn);
  }
  _removeEventHandler(guid) {
    this._connectedMessageHooks.delete(guid);
  }
  callMethod(method, ...args) {
    let handle = guid();
    return new Promise((resolve, reject) => {
      this._addCallback(handle, (event) => {
        if (event.value === 'ok') {
          resolve(event.payload);
        } else {
          reject(event.error);
        }
      });
      let message = {
        target: '_background',
        handle: handle,
        window: windowId,
        messageType: method,
        arguments: args
      };
      console.log('sending', message);
      chrome.runtime.sendMessage(null, message);
    });
  }
  connectCallback(id, message, fn) {
    let handle = guid();
    return new Promise((resolve, reject) => {
      this._addCallback(handle, (event) => {
        if (event.value === 'ok') {
          messageHub._addEventCallback(event.streamHandle, fn);
          resolve(event.streamHandle);
        } else {
          reject(event.error);
        }
      });
      chrome.runtime.sendMessage(null, {
        target: '_background',
        handle: handle,
        window: windowId,
        messageType: 'addListener',
        arguments: [id, message]
      });
    });
  }
  disconnectCallback(id) {
    let handle = guid();

    return new Promise((resolve, reject) => {
      this._addCallback(handle, (event) => {
        if (event.value === 'ok') {
          messageHub._removeEventHandler(id);
          resolve();
        } else {
          reject(event.error);
        }
      });
      chrome.runtime.sendMessage(null, {
        target: '_background',
        handle: handle,
        window: windowId,
        messageType: 'removeListener',
        arguments: [id]
      });
    });
  }

}

var eventCallbackHooks = new WeakMap();
var messageHub = new MessageMaster()

class EventHandler {
  constructor(id, eventHandlerName, parent) {
    this._id = id;
    this._eventHandlerName = eventHandlerName;
    this._parent = parent;
  }
  async addListener(callback) {
    let callbackId = await messageHub.connectCallback(
        this._id, 
        this._eventHandlerName, 
        (ev) => {
      console.log('received event');
      callback(ev.payload);
    });
    let callbacks = eventCallbackHooks.get(this._parent);
    if (!callbacks) {
      eventCallbackHooks.set(this._parent, (callbacks = new WeakMap()));
    }
    callbacks.set(callback, callbackId);
  }
  async removeListener(callback) {
    let callbacks = eventCallbackHooks.get(this._parent);
    if (callbacks) {
      let callbackId = callbacks.get(callback);
      if (callbackId) {
        await messageHub.disconnectCallback(callbackId);
      }
    }
  }
}

export default class PortForwardingRuleProxy {
  constructor(id) {
    this._id = id;
  }
  get id() {
    return this._id;
  }
  get onStateChanged() {
    return new EventHandler(this._id, 'onStateChanged', this);
  }
  getState() {
    return messageHub.callMethod('getState', this._id);
  }
  activate() {
    return messageHub.callMethod('activate', this._id);
  }
  disconnect() {
    return messageHub.callMethod('disconnect', this._id);
  }
  forceDisconnect() {
    return messageHub.callMethod('forceDisconnect', this._id);
  }
  dispose() {
    return messageHub.callMethod('dispose', this._id);
  }
  static async getAllForwardingRules() {
    var ruleIds = await messageHub.callMethod('getAllForwardingRules');
    return ruleIds.map((id) => new PortForwardingRuleProxy(id))
  }
  
  static async newPortForwardingRule(localHostPort, 
      remoteHostIp, remoteHostPort, id) {
    await messageHub.callMethod(
        'newPortForwardingRule', 
        localHostPort, 
        remoteHostIp, 
        remoteHostPort, 
        id);
    return new PortForwardingRuleProxy(id);
  }
}
