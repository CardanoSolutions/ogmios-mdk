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

import * as SafeJson from "./safe-json.mjs";
import { IsoWebSocket } from "./iso-websocket.mjs";

/**
 * @type {object}
 * @property {function} parse A drop-in replacement for JSON.parse that handles big numbers.
 * @property {function} stringify A drop-in replacement for JSON.stringify that handles big numbers.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify}
 */
export const Json = SafeJson.Json;

/** @private */
const DEFAULT_CONNECTION_STRING = "ws://127.0.0.1:1337";

/**
 * Creates an RPC-2.0 payload from a method, optional params and an optional id.
 *
 * @param {string} method
 * @param {object} [params]
 * @param {any} [id]
 * @return {string}
 */
export function rpc(method, params = {}, id) {
  return Json.stringify({
    jsonrpc: "2.0",
    method,
    params,
    ...(id && { id }),
  });
}

/**
 * @callback application
 * @param {WebSocket} ws An isomorphic WebSocket connected to a running Ogmios server. The
 *                       socket is enhanced with an extra {@link rpc} method, as a shorthand
 *                       for chaining `.send(rpc(...))`.
 * @param {done} done A callback to mark the end of the application, possibly yielding a result.
 *
 * @see {@link https://github.com/websockets/ws/blob/master/doc/ws.md}
 */

/**
 * @callback done
 * @param {any} [result] An optional result returned by the application.
 */

/**
 * Open a connection to Ogmios, and run the provided callback. The websocket is passed as a callback
 * for subsequent operations.
 *
 * @param {application} callback Continuation once the connection has been established.
 * @param {string} [connectionString] Server's connection string, or localhost.
 * @return {Promise}
 *
 * @example
 * ogmios((ws, done) => {
 *   ws.once('message', (data) => {
 *     done(Json.parse(data).result);
 *   });
 *
 *   ws.rpc('queryLedgerState/tip');
 * });
 */
export function ogmios(callback, connectionString = DEFAULT_CONNECTION_STRING) {
  return new Promise((resolve, reject) => {
    const ws = new IsoWebSocket(connectionString, {
      maxPayload: Number.MAX_SAFE_INTEGER,
    });

    let output;

    ws.rpc = function (method, params, id) {
      ws.send(rpc(method, params, id));
    };

    function request(method, params) {
      return new Promise((resolve, reject) => {
        ws.once("message", (data) => {
          const { error, result } = Json.parse(data);
          if (error !== undefined) {
            reject(error);
          } else {
            resolve(result);
          }
        });

        ws.rpc(method, params);
      });
    }

    ws.queryLedgerState = function (method, params) {
      return request(`queryLedgerState/${method}`, params);
    };

    ws.queryNetwork = function (method, params) {
      return request(`queryNetwork/${method}`, params);
    };

    ws.on("close", (code, reason, data) => {
      if (code !== 1000) {
        reject({
          message: "connection ended with error.",
          code,
          reason: reason.toString(),
          ...(data && { data }),
        });
      } else {
        resolve(output);
      }
    });

    ws.on("error", reject);

    ws.once("open", async () => {
      output = await new Promise((done) => callback(ws, done));
      ws.close();
    });
  });
}
