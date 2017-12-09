import {Element as PolymerElement} from '../node_modules/@polymer/polymer/polymer-element.js';
import {} from '../node_modules/@polymer/polymer/lib/elements/dom-repeat.js';
import {} from '../node_modules/@polymer/polymer/lib/elements/dom-if.js';
import {} from '../node_modules/@polymer/paper-button/paper-button.js';
import PiperPortRule from './components/piper-port-rule.js';
import guid from './common/guid.js';
import PortForwardingRuleProxy from './common/port-forwarding-rule-proxy.js';

class PiperConfigApp extends PolymerElement {
  constructor() {
    super();
    this.loading = true;
    
    Promise.all([
      PortForwardingRuleProxy.getAllForwardingRules(),
      new Promise((resolve) => {
        chrome.storage.local.get('rules', (config) => {
          resolve(config['rules'] || [])
        });
      }),
    ]).then(([activeIds, rules]) => {
      PortForwardingRuleProxy._existingSockets = new Map();
      for (var port of activeIds) {
        PortForwardingRuleProxy._existingSockets.set(port.id, port);
      }
      this.rules = rules;
      this.loading = false;
    });
  }
  static get properties() {
    return {
      'loading': {
        type: Boolean,
      },
      'rules': {
        type: Array,
        value: []
      },
      'noRules': {
        type: Boolean,
        computed: '_isRulesEmpty(rules.length)'
      },
      _refreshCount: {
        type: Number,
        value: 0
      }
    }
  }
  static get is() {
    return 'piper-config-app';
  }
  static get observers() {
    return ['_rulesChanged(rules.*)']
  }
  static get template() {
    return `
      <style>
        :host {
          padding: 16px 8px;
          max-width: 800px;
          margin: 0 auto;
          display: block;
          overflow: auto;
        }
        .header-row {    
          display: flex;
          flex-direction: row;
          align-items: flex-end;
          min-height: 48px;
          padding: 1rem 0;
          justify-content: space-between;
        }
        .body-rules {
          @apply(--shadow-elevation-2dp);
          background-color: rgb(247, 247, 247);
          border: 1px solid rgba(206, 206, 206, 0.35);
          border-radius: 2px;
        }
        .no-rules {
          height: 48px;
          text-align: center;
          background-color: #eee;
          font-size: 14px;
          line-height: 48px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        h1 {    
          background-image: url(./sandpiper.svg);
          margin: 0;
          padding: 2em 0 0.5em 4em;
          background-repeat: no-repeat;
        }

      </style>
      <div class="header-row">
        <h1>piper</h1>
        <paper-button disabled$="[[loading]]" 
                      raised 
                      on-click="_addRule">Add new forwarding rule</paper-button>
      </div>
      <div class="body-rules" on-port-usage-changed="_refreshAllRules"
                              on-port-deleted="_deleteRule">
        <dom-repeat items="{{rules}}">
          <template>
            <piper-port-rule rule-index="[[index]]" 
                            rule="{{item}}"
                            rules="[[rules]]"
                            refresh-count$="[[_refreshCount]]">
            </piper-port-rule>
          </template>
        </dom-repeat>
        <dom-if if="[[noRules]]">
          <template>
            <div class="no-rules">
              You don't have any port forwarding rules</div>
          </template>
        </dom-if>
      </div>
      <footer><p>For information and source, check out <a target="_blank" href="https://www.github.com/llamadonica/piper">https://www.github.com/llamadonica/piper</a>.</footer>
    `;
  }
  _rulesChanged() {
    if (this.loading) return;
    if (this._syncing) {
      this._oversync = true;
    }
    this._syncing = true;
    const doSync = () => {
      chrome.storage.local.set({rules: this.rules}, () => {
        if (this._oversync) {
          this._oversync = false;
          doSync();
        } else {
          this._syncing = false;
        }
      });
    }
    doSync();
    
  }
  _isRulesEmpty(rulesLength) {
    return !rulesLength;
  }
  _addRule() {
    this.push('rules', {id: guid(), state: 'closed'});
  }
  _refreshAllRules() {
    console.log('someone let me know that a rule started or stopped');
    this._refreshCount++;
  }
  _deleteRule(ev) {
    this.splice('rules', ev.detail.index, 1);
  }
}

window.customElements.define(PiperConfigApp.is, PiperConfigApp);