// Copyright 2025 KtorZ <matthias.benkort@gmail.com>
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/** @module iso_websocket
 * @private
 */

import Base from "isomorphic-ws";

/** @private */
export class IsoWebSocket extends Base {
  constructor(addr, opts) {
    if (isBrowser) {
      super(addr);
    } else {
      super(addr, opts);
    }

    return isBrowser && !isPolyfilled(this) ? Object.assign(this, browserPolyfill(this)) : this;
  }
}

/** @private */
function browserPolyfill(target) {
  let listeners = [];

  function removeListener(event, fn) {
    listeners = listeners.reduce((acc, [e, orig, handler]) => {
      if (e === event && orig === fn) {
        target.removeEventListener(e, handler);
      } else {
        acc.push([e, orig, handler]);
      }
      return acc;
    }, []);
  }

  return {
    on(event, fn) {
      const handler = (e) => (typeof e.data !== "undefined" ? fn(e.data) : fn(e));
      listeners.push([event, fn, handler]);
      target.addEventListener(event, handler);
    },

    once(event, fn) {
      const handler = (e) => {
        removeListener(event, fn);
        typeof e.data !== "undefined" ? fn(e.data) : fn(e);
      };
      listeners.push([event, fn, handler]);
      target.addEventListener(event, handler, { once: true });
    },

    setMaxListeners(_n) {},

    removeListener,

    removeAllListeners() {
      listeners.forEach(([event, _orig, handler]) => target.removeEventListener(event, handler));
      listeners = [];
    },
  };
}

/** @private */
const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";

/** @private */
function isPolyfilled(o) {
  return (
    typeof o.on === "function" &&
    typeof o.once === "function" &&
    typeof o.removeListener === "function" &&
    typeof o.removeAllListeners === "function"
  );
}
