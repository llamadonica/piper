(function () {
  'use strict';
  /** @private */
  const app = chrome.app;

  app.runtime.onLaunched.addListener(() => {
    app.window.create('config.html', {
      id: 'config_win',
      innerBounds: {
        width: 864,
        height: 200
      }
    });
  });

  const _DATA = Symbol('_data');

  /** 
   *  @private  */ 
  class AppPortBoss {
    constructor() {
      /** @private */
      this.onAccept = new AppPortEventHandler((ev) => ev.socketId, chrome.sockets.tcpServer.onAccept);
      /** @private */
      this.onAcceptError = new AppPortEventHandler((ev) => ev.socketId, chrome.sockets.tcpServer.onAcceptError);
      /** @private */
      this.onReceive = new AppPortEventHandler((ev) => ev.socketId, chrome.sockets.tcp.onReceive);
      /** @private */
      this.onReceiveError = new AppPortEventHandler((ev) => ev.socketId, chrome.sockets.tcp.onReceiveError);
    }
  }

  /** 
   *  @private  */ 
  class AppPortEventHandler {
    constructor(keyExtractor, realEvent) {
      this._realEvent = realEvent;
      this._keyExtractor = keyExtractor;
      this._mapping = new Map();
      this._onEvent = this.__onEvent.bind(this);
    }
    __onEvent(ev) {
      const key = this._keyExtractor(ev);
      const callback = this._mapping.get(key);
      if (callback) {
        callback(ev);
      }
    }
    addListener(key, callback) {
      if (this._mapping.size === 0) {
        this._realEvent.addListener(this._onEvent);
      }
      this._mapping.set(key, callback);
    }
    removeListener(key) {
      this._mapping.delete(key);
      if (this._mapping.size === 0) {
        this._realEvent.removeListener(this._onEvent);
      }
    }
  }

  /** 
   *  @private  */ 
  class LinkedList {
    constructor() {
      this._next = this;
      this._prev = this;
      this._count = 0;
    }
    addToTail(value) {
      let newNode = new _LinkedListNode(value);
      newNode._next = this;
      newNode._prev = this._prev;
      
      this._prev._next = newNode;
      this._prev = newNode;
      this._count++;
    }
    removeFromHead() {
      if (this._count === 0) {
        return null;
      }
      let firstNode = this._next;
      this._next = firstNode._next;
      this._next._prev = this;
      this._count--;
      return firstNode._value;
    }
    get count() {
      return this._count;
    }
  }

  class _LinkedListNode {
    constructor(value) {
      this._value = value;
      this._next = null;
      this._prev = null;
    }
  }

  const serverMaster = new AppPortBoss();

  window['PortForwardingRule'] = class PortForwardingRule {
    constructor(localHostPort, remoteHostIp, remoteHostPort) {
      this._data = {};
      this._data.localHostPort = localHostPort;
      this._data.remoteHostIp = remoteHostIp;
      this._data.remoteHostPort = remoteHostPort;
      
      this._isActive = false;
      this._pendingStateChanges = 0;
      this._stateSettled = Promise.resolve();
      this._connectedPorts = new Set();
      this._onStateChanged = new EventStream();
      this._onConnectionError = new EventStream();
      this._onConnectedPortsChanged = new EventStream();
      this._nConnectedPorts = 0;
      this._currentState = 'stopped';
      this._onStateChanged.addListener((ev) => this._currentState = ev.currentState);

      this._onReceiveMap = new Map();
      this._onReceiveErrorMap = new Map();
    }
    
    get onStateChanged() {
      return this._onStateChanged;
    }
    get onConnectionError() {
      return this._onConnectionError;
    }
    get onConnectedPortsChanged() {
      return this._onConnectedPortsChanged;
    }

    async _closePort(socketId) {
      let portClosed = !this._connectedPorts.has(socketId);
      
      this._connectedPorts.delete(socketId);
      serverMaster.onReceive.removeListener(socketId);
      serverMaster.onReceiveError.removeListener(socketId);

      this._onReceiveMap.delete(socketId);
      this._onReceiveErrorMap.delete(socketId);

      await new Promise((resolve) => {
        if (portClosed) {
          resolve();
        } else {
          chrome.sockets.tcp.close(socketId, () => {
            resolve();
          });
        }
      });
      if (!portClosed) {
        this._onConnectedPortsChanged.dispatch({currentState: --this._nConnectedPorts})
      }

    }
    
    async _handleAccept(clientSocketId) {

      this._connectedPorts.add(clientSocketId);
      this._onConnectedPortsChanged.dispatch({currentState: ++this._nConnectedPorts});
      
      let hasConnectedBefore = this._hasConnected;
      this._hasConnected = true;
      
      const _closeConnections = (createInfo) => {
        let oldStateSettled = this._stateSettled;

        let remotePortClosed = !this._connectedPorts.has(clientSocketId);
        let localPortClosed = !this._connectedPorts.has(createInfo.socketId);

        const _closeState = async () => {
          await oldStateSettled;
          await Promise.all([
            this._closePort(clientSocketId),
            this._closePort(createInfo.socketId)
          ]);
        };
        
        this._stateSettled = _closeState();
        return this._stateSettled;
      };
      let backlog = [];
      let createInfo = await new Promise((resolve) => {
        chrome.sockets.tcp.create({}, (createInfo) => {
          this._connectedPorts.add(createInfo.socketId);
          this._onConnectedPortsChanged.dispatch({currentState: ++this._nConnectedPorts});
          resolve(createInfo);
        });
      });
      await new Promise((resolve) => {
        chrome.sockets.tcp.setPaused(createInfo.socketId, true, () => {
          resolve();
        });
      });
      await new Promise((resolve, reject) => {
        chrome.sockets.tcp.connect(createInfo.socketId, this[_DATA].remoteHostIp, this[_DATA].remoteHostPort, (resultCode) => {
          var error;
          if (resultCode < 0) {
            if (resultCode !== -100) {
              error = chrome.runtime.lastError;
            }
            if (this._currentState != 'connection_failed') {
              this._onStateChanged.dispatch({
                currentState: 'connection_failed',
                isFinal: true
              });
            }
            _closeConnections(createInfo).then(() => reject(error));
          } else {
            resolve(createInfo);
          }
        });
      });
      
      let backlogToClient = new LinkedList();
      let backlogToServer = new LinkedList();
      let isSendingToPort = new Map();
      
      const _flushBacklog = (sendPort, data, backlog) => {
        backlog.addToTail(data);
        if (isSendingToPort.get(sendPort)) {
          return;
        }
        isSendingToPort.set(sendPort, true);
        const _sendZeroOrOnePacket = () => {
          if (backlog.count === 0) {
            isSendingToPort.set(sendPort, false);
            return;
          }
          let portsClosed = !this._connectedPorts.has(sendPort);
          let packet = backlog.removeFromHead();
          chrome.sockets.tcp.send(sendPort, packet, () => _sendZeroOrOnePacket());
        };
        _sendZeroOrOnePacket();
      };
      
      serverMaster.onReceive.addListener(clientSocketId, (info) => {
        _flushBacklog(createInfo.socketId, info.data, backlogToServer);
      });
      serverMaster.onReceive.addListener(createInfo.socketId, (info) => {
        _flushBacklog(clientSocketId, info.data, backlogToClient);
      });
      serverMaster.onReceiveError.addListener(clientSocketId, (info) => {
        _closeConnections(createInfo);
      });
      serverMaster.onReceiveError.addListener(createInfo.socketId, (info) => {
        _closeConnections(createInfo);
      });
      chrome.sockets.tcp.setPaused(createInfo.socketId, false);
      chrome.sockets.tcp.setPaused(clientSocketId, false);
    }
    
    _handleAcceptError(resultCode) {
      this._onConnectionError.dispatch({
        resultCode: resultCode
      });
      let oldStateSettled = this._stateSettled;
      this._stateSettled = oldStateSettled.then(() => {
        return new Promise((resolve) => {
          chrome.sockets.tcpServer.setPaused(this._socketId, false, () => {
            resolve();
          });
        });
      });
    }
    activate() {
      this._pendingStateChanges++;
      let oldStateSettled = this._stateSettled;
      const _activateAsync = async () => {
        await oldStateSettled;
        if (this._currentState == 'startup' || this._currentState == 'listening') {
          return;
        }
        this._onStateChanged.dispatch({
          currentState: 'startup',
          isFinal: this._pendingStateChanges === 0
        });
        let createInfo = await new Promise((resolve, reject) => {
          chrome.sockets.tcpServer.create({}, (createInfo) => {
            resolve(createInfo);
          });
        });
        this._socketId = createInfo.socketId;
        this._hasConnected = false;
        try {
          await new Promise((resolve, reject) => {
            chrome.sockets.tcpServer.listen(
                createInfo.socketId,
                '127.0.0.1',
                this[_DATA].localHostPort, (result) => {
                  if (result < 0) {
                    reject(`Listening on port ${this[_DATA].localHostPort} resulted in error code ${result}`);
                  } else {
                    resolve({result, createInfo});
                  }
                });
          });
          serverMaster.onAccept.addListener(createInfo.socketId, (info) => {
            this._handleAccept(info.clientSocketId);
          });
          serverMaster.onAcceptError.addListener(createInfo.socketId, (info) => {
            this._handleAcceptError(info.resultCode);
          });
          this._pendingStateChanges--;
          this._onStateChanged.dispatch({
            currentState: 'listening',
            isFinal: this._pendingStateChanges === 0
          });
        } catch (err) {
          let oldSocketId = this._socketId;
          this._socketId = null;
          await new Promise((resolve) => {
            chrome.sockets.tcp.close(oldSocketId, () => {
              resolve();
            });
          });
          this._pendingStateChanges--;
          this._onStateChanged.dispatch({
            currentState: 'aborted',
            isFinal: this._pendingStateChanges === 0
          });
        }
      };
      this._stateSettled = _activateAsync();
      return this._stateSettled;
    }

    async _preDisconnect() {
      this._pendingStateChanges++;
      let localServerCopy = this._socketId;
      this._socketId = null;

      if (this._currentState == 'pre_close' || this._currentState == 'closing' || this._currentState == 'closed') {
        return localServerCopy;
      }

      if (localServerCopy != null) {
        this._onStateChanged.dispatch({
          currentState: 'pre_close',
          isFinal: this._pendingStateChanges === 0
        });

        await new Promise((resolve) => {
          chrome.sockets.tcpServer.disconnect(localServerCopy, () => {
            resolve();
          });
        });
        serverMaster.onAccept.removeListener(localServerCopy);
        serverMaster.onAcceptError.removeListener(localServerCopy);

        this._onStateChanged.dispatch({
          currentState: 'closing',
          isFinal: this._pendingStateChanges === 0
        });
      }
      
      this._pendingStateChanges--;
      return localServerCopy;
    }

    async _postDisconnect(localServerCopy) {
      if (localServerCopy != null) {
        await new Promise((resolve) => {
          chrome.sockets.tcpServer.close(localServerCopy, () => {
            resolve();
          });
        });
      }
    }

    _disconnectWithPortsStep(portDisconnector) {
      this._pendingStateChanges++;
      const oldStateSettled = this._stateSettled;
      const disconnectAsync = async () => {
        await oldStateSettled;

        let localServerCopy = await this._preDisconnect();
        
        try {
          await portDisconnector();
        } finally {
          await this._postDisconnect(localServerCopy);
        }
        this._pendingStateChanges--;
        this._onStateChanged.dispatch({
          currentState: 'closed',
          isFinal: this._pendingStateChanges === 0
        });
      };
      this._stateSettled = disconnectAsync();
      return this._stateSettled;
    }

    disconnect() {
      return this._disconnectWithPortsStep(async () => {
        if (this._nConnectedPorts > 0) {
          // wait for the number of connected ports to drop to zero.
          await new Promise((resolve) => {
            const onConnectedPortsChanged = ({currentState}) => {
              if (currentState == 0) {
                this.onConnectedPortsChanged.removeListener(onConnectedPortsChanged);    
                resolve();
              }
            }
            this.onConnectedPortsChanged.addListener(onConnectedPortsChanged);
          });
        }
      });
    }

    async forceDisconnect() {
      const stateChangesToClosed = async () => new Promise((resolve) => {
        const onStateChangedToClosing = (ev) => {
          if (ev.currentState == 'closed') {
            // This is really the only valid transition here...
            this.onStateChanged.removeListener(onStateChangedToClosing);
            resolve();
          }
        };
        this.onStateChanged.addListener(onStateChangedToClosing)
      });
      const closeAllPorts = async () => {
        if (this._nConnectedPorts > 0) {
          let _connectedPorts = [...this._connectedPorts];
          await Promise.all(_connectedPorts.map((port) => this._closePort(port)));
        }
      };
      if (this._currentState == 'closed') {
        return;
      } else if (this._currentState == 'pre_close') {
        const onStateChangedToClosing = (ev) => {
          if (ev.currentState == 'closing') {
            // This is really the only valid transition here...
            closeAllPorts()
          }
          this.onStateChanged.removeListener(onStateChangedToClosing);
        };
        this.onStateChanged.addListener(onStateChangedToClosing)
        await stateChangesToClosed();
      } else if (this._currentState == 'closing') {
        closeAllPorts();
        await stateChangesToClosed();
      } else {
        await this._disconnectWithPortsStep(closeAllPorts);
      }
    }
  }
  class EventStream {
    constructor() {
      this.eventList = [];
    }
    addListener(callback, options) {
      this.eventList.push({callback: callback, options: options});
    }
    removeListener(callback, options) {
      let eventIndex = this.eventList.findIndex((el) => {
        if (el.callback != options) {
          return false;
        }
        if (options) {
          if ((options.once || false) != (el.options.once || false)) {
            return false;
          }
        }
        return true;
      });
      if (eventIndex >= 0) {
        this.eventList.splice(eventIndex, 1);
      }
    }
    dispatch(event) {
      for (let callback of [...this.eventList]) {
        callback.callback(event);
        if (callback.options && callback.options.once) {
          removeEventListener(event.type, callback.callback, callback.options);
        }
      }
      
    }
  }
});