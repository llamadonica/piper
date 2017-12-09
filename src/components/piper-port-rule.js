
import {Element as PolymerElement} from '../../node_modules/@polymer/polymer/polymer-element.js';
import {} from '../../node_modules/@polymer/paper-input/paper-input.js';
import {} from '../../node_modules/@polymer/paper-button/paper-button.js';
import {} from '../../node_modules/@polymer/polymer/lib/elements/dom-if.js';
import PortForwardingRuleProxy from '../common/port-forwarding-rule-proxy.js';

export default class PiperPortRule extends PolymerElement {
  constructor() {
    super();
  }
  static get properties() {
    return {
      'rules': {
        type: Array,
        value: []
      },
      'rule': {
        type: Object
      },
      ruleIndex: {
        type: Number,
        observer: '_ruleIndexChanged'
      },
      portInvalid: {
        type: Boolean
      },
      remoteHostInvalid: {
        type: Boolean
      },
      remotePortInvalid: {
        type: Boolean
      },
      isReady: {
        type: Boolean,
        value: false
      },
      canBeActivated: {
        type: Boolean,
        computed: '_canBeActivated(portInvalid, remoteHostInvalid, remotePortInvalid, rule.port, rule.remoteHost, rule.remotePort, isReady, refreshCount)'
      },
      canBeDisconnected: {
        type: Boolean,
        computed: '_canBeDeactivated(rule.state)'
      },
      refreshCount: {
        type: Number
      }

    }
  }
  static get is() {
    return 'piper-port-rule';
  }
  static get template() {
    return `
      <style>
        @keyframes spin {
          from {transform:rotate(0deg);}
          to {transform:rotate(360deg);}
        }
        
        @keyframes blink {
          from {
            background-color: #ddd;
          }
          
          16.66666% {
            background-color: #ddd;
          }
          
          16.66667% {
            background-color: #e22c2c
          }
          
          83.33333% {
            background-color: #e22c2c
          }
                    
          to {
            background-color: #ddd;
          }
        }
        :host {    
          display: flex;
          padding: 0 1.8em 0.8em 0;
          align-items: center;
          border-top: 1px solid rgba(206,206,206,0.35);
        }
        :host(:first-child) {
          border-top: 0 none transparent;
        }
        paper-input {
          flex: 1 1 auto;
          margin-left: 1.8em;
          --paper-font-subhead: {
            font-size: 14px;
          };
        }
        .activity-monitor {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background-color: #ddd;
          margin: 0.8em -0.5em 0 1.8em;
          box-sizing: border-box;
        }
        .activity-monitor.listening {
          background-color: rgb(76, 175, 80);
        }
        .activity-monitor.aborted, .activity-monitor.connection_failed {
          animation: blink 300ms infinite linear;
        }
        .activity-monitor.closing {
          animation: spin 1s infinite linear;
          background-color: transparent;
          border: 2px solid transparent;
          border-top: 2px solid #e22c2c;
          border-right: 2px solid #e22c2c;
        }
        paper-button {
          margin-top: 18px;
          margin-left: 2em;
          --paper-button: {
            overflow: hidden;
            text-overflow: ellipsis;
          };
          transition: 
              box-shadow 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1);
        }
        paper-button[disabled] {
          opacity: 0.5;

        }
        .activate {
          background-color: rgb(76, 175, 80);
          color: #fff;
        }
        .delete {
          background-color: #e22c2c;
          color: #fff;
        }
        .port-number {
          width: 6em;
        }
        .host-name {
          width: 12em;
        }
      </style>
      <div class$="activity-monitor [[rule.state]]"></div>
      <paper-input class="port-number"
                   label="Local port number" 
                   auto-validate 
                   type="number"
                   min="1025"
                   max="65535"
                   invalid="{{portInvalid}}"
                   disabled="[[rule.isInUse]]"
                   error-message="Must be a number > 1025"
                   value="{{rule.port}}"></paper-input>
      <paper-input class="host-name"
                   label="Remote host" 
                   auto-validate 
                   invalid="{{remoteHostInvalid}}"
                   disabled="[[rule.isInUse]]"
                   pattern="^(((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?|(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9]))$"
                   error-message="Must be a valid hostname, IPv4, or IPv6"
                   value="{{rule.remoteHost}}"></paper-input>
      <paper-input class="port-number"
                   label="Remote port" 
                   auto-validate 
                   type="number"
                   min="1"
                   max="65535"
                   disabled="[[rule.isInUse]]"
                   invalid="{{remotePortInvalid}}"
                   error-message="Must be an integer > 0"
                   value="{{rule.remotePort}}"></paper-input>
      
      <paper-button class="activate"
                    raised 
                    disabled$="[[!canBeActivated]]"
                    on-click="_activateRule">activate</paper-button>
      <paper-button class="disconnect"
                    raised 
                    disabled$="[[!canBeDisconnected]]"
                    on-click="_disconnectRule">disconnect</paper-button>
      <paper-button class="force-disconnect"
                    raised 
                    disabled="[[!rule.isInUse]]"
                    on-click="_forceDisconnectRule">force disconnect</paper-button>
      <paper-button class="delete"
                    raised 
                    disabled="[[rule.isInUse]]"
                    on-click="_deleteRule">delete</paper-button>
    `;
  }
  static get observers() {
    return ['_notifyUsageChanged(rule.isInUse)', '_getRule(rule.id)'];
  }
  async _getRule(ruleId) {
    var socket = PortForwardingRuleProxy._existingSockets.get(ruleId);
    this._disconnectSocket();
    if (socket) {
      console.log('rule already had a socket. connecting.');
      this.set('rule.isInUse', true);
      let hasReceivedChange = false;
      let listener = this._listener = (ev) => {
        if (this._socket == socket) {
          hasReceivedChange = true;
          this.set('rule.state', ev.currentState);
          if (ev.currentState == 'closed' || ev.currentState == 'aborted') {
            this._disconnectSocket();
          }
        }
      };
      this._socket = socket;
      socket['onStateChanged'].addListener(listener);
      socket.getState().then((newState) => {
        if (!hasReceivedChange) {
          this.set('rule.state', newState);
          if (newState == 'closed' || newState == 'aborted') {
            this._disconnectSocket();
          }
        }
      });

    } else {
      console.log('rule did not have a socket.');
      this.set('rule.state', 'stopped');
    }
  }
  disconnectedCallback() {
    this._connected = false;
    let socket = this._socket;
    if (socket) {
      this._socket = null;
    }
    let listener = this._listener;
    if (listener) {
      this._listener = null;
      socket['onStateChanged'].removeListener(listener);
    }
  }
  connectedCallback() {
    this._connected = true;
    requestAnimationFrame(() => {
      this.dispatchEvent(
        new CustomEvent('port-usage-changed', {bubbles: true}));
      this.isReady = true;
    });
  }
  _notifyUsageChanged() {
    console.log('usage changed. letting everyone know.');
    if (this._connected) {
      this.dispatchEvent(
        new CustomEvent('port-usage-changed', {bubbles: true}));
    }
  }
  _ruleIndexChanged(newValue) {
    if (this._isLinked) {
      this.unlinkPaths('rule');
    }
    if (newValue != null) {
      this.linkPaths('rule', `rules.${newValue}`);
      this._isLinked = true;
    }
  }
  _canBeActivated(
      portInvalid, 
      remoteHostInvalid, 
      remotePortInvalid, 
      port, 
      remoteHost, 
      remotePort,
      isReady) {
    console.log('checking whether I can be activated');
    if (!isReady || portInvalid || remotePortInvalid || remoteHostInvalid || !port || !remoteHost || !remotePort ) {
      return false;
    }
    let localPortInteger = Number(port) | 0;
    return !this.rules.some((val) => {
      let otherPortInteger = Number(val.port)|0;
      return val.isInUse && otherPortInteger == localPortInteger;
    });
  }
  _canBeDeactivated(state) {
    return (state === 'listening');
  }
  _disconnectSocket() {
    var socket = this._socket;
    var listener = this._listener;
    if (socket) {
      socket.dispose();
      this._socket = null;
      this._listener = null;
      socket['onStateChanged'].removeListener(listener);
    }
    console.log('socket is now disconnected.');
    this.set('rule.isInUse', false);
  }
  _activateRule() {
    this._disconnectSocket();
    console.log('socket is connected.');
    this.set('rule.isInUse', true);
    let localPortInteger = Number(this.rule.port) | 0;
    let remotePortInteger = Number(this.rule.remotePort) | 0;
    let hasReceivedChange = false;
    PortForwardingRuleProxy.newPortForwardingRule(
        localPortInteger, 
        this.rule.remoteHost, 
        remotePortInteger, 
        this.rule.id
    ).then((socket) => {
      let listener = this._listener = (ev) => {
        if (this._socket == socket) {
          hasReceivedChange = true;
          this.set('rule.state', ev.currentState);
          if (ev.currentState == 'closed' || ev.currentState == 'aborted') {
            this._disconnectSocket();
          }
        }
      };
      this._socket = socket;
      socket['onStateChanged'].addListener(listener);
      return Promise.all([socket.getState(), Promise.resolve(socket)]);
    }).then(([newState, socket]) => {
      if (!hasReceivedChange) {
        this.set('rule.state', newState);
      }
      socket.activate();
    });
    
  }
  _disconnectRule() {
    let socket = this._socket;
    socket.disconnect();
  }
  _forceDisconnectRule() {
    let socket = this._socket;
    socket.forceDisconnect();
  }
  _deleteRule() {
    this.dispatchEvent(new CustomEvent('port-deleted', {bubbles: true, detail: {index: this.ruleIndex}}));
  }
}

window.customElements.define(PiperPortRule.is, PiperPortRule);