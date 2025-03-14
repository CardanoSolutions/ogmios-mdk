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

/** @namespace OgmiosWebSocket */
/** @module @cardano-ogmios/mdk */

import * as SafeJson from "./safe-json.mjs";
import { IsoWebSocket } from "./iso-websocket.mjs";

/**
 * @memberOf module:@cardano-ogmios/mdk
 * @public
 * @type {object}
 * @property {function} parse
 *  A drop-in replacement for JSON.parse that handles big numbers.
 * @property {function} stringify
 *  A drop-in replacement for JSON.stringify that handles big numbers.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify}
 */
export const Json = SafeJson.Json;

/** @private */
const DEFAULT_CONNECTION_STRING = "ws://127.0.0.1:1337";

/** @private */
const INITIAL_PIPELINE_BURST = 100;

/**
 * @memberOf module:@cardano-ogmios/mdk
 *
 * @description
 *   Creates an RPC-2.0 payload from a method, optional params and an optional id.
 * @param {string} method
 * @param {object} [params]
 * @param {any} [id]
 * @return {string}
 */
export function newRpcRequest(method, params = {}, id) {
  return Json.stringify({
    jsonrpc: "2.0",
    method,
    params,
    ...(id && { id }),
  });
}

/**
 * @callback application
 * @memberOf module:@cardano-ogmios/mdk
 * @param {OgmiosWebSocket.OgmiosWebSocket} ws
 *  An isomorphic WebSocket-like interface connected to a running Ogmios server. In addition to the
 *  usual event listeners methods, the object is enhanced with handful of useful methods.
 * @param {module:@cardano-ogmios/mdk.done} done
 *  A callback to mark the end of the application, possibly yielding a result.
 */

/**
 * @memberOf module:@cardano-ogmios/mdk
 *
 * @description
 *  Open a connection to Ogmios, and run the provided callback. The websocket is passed as a
 *  callback for subsequent operations.
 * @async
 * @param {module:@cardano-ogmios/mdk.application} callback
 *  Continuation once the connection has been established.
 * @param {string} [connectionString="ws://127.0.0.1:1337"]
 *  Server's connection string, or localhost.
 * @return {Promise}
 *  A promise returning whatever is passed to the `done` callback.
 *
 * @example
 * await ogmios((ws, done) => {
 *   ws.once('message', (data) => {
 *     done(Json.parse(data).result);
 *   });
 *
 *   ws.rpc('queryLedgerState/tip');
 * });
 */
export function ogmios(callback, connectionString = DEFAULT_CONNECTION_STRING) {
  return new Promise((resolve, reject) => {
    /**
     * @memberOf OgmiosWebSocket
     *
     * @typedef OgmiosWebSocket
     * @mixes Websocket
     * @type {object}
     * @property {OgmiosWebSocket.rpc} rpc
     *  Perform an arbitrary rpc query using the given method name and optional parameters.
     * @property {OgmiosWebSocket.queryLedgerState} queryLedgerState
     *  A short-hand for running a single ledger-state query.
     * @property {OgmiosWebSocket.queryNetwork} queryNetwork
     *  A short-hand for running a single network query.
     * @property {OgmiosWebSocket.newChainFollower} newChainFollower
     *  Create a generator for following the chain from any given point.
     * @see {@link https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocket WebSocket}
     */
    const ws = new IsoWebSocket(connectionString, {
      maxPayload: Number.MAX_SAFE_INTEGER,
    });

    let output;

    ws.once("close", (code, reason, data) => {
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

    ws.once("error", reject);

    ws.once("open", async () => {
      /**
       * @callback done
       * @memberOf module:@cardano-ogmios/mdk
       * @param {any} [result]
       *  An optional result returned by the application.
       */
      output = await new Promise((done) => callback(ws, done));
      ws.close();
    });

    // ----------------------------------------------------------------------------- General Helpers
    /**
     * @memberOf OgmiosWebSocket
     *
     * @description
     *  Perform an arbitrary rpc query using the given method name and optional parameters. This supposes
     *  that an event listener on `"message"` has been installed.
     *
     * @callback rpc
     * @param {string} method
     *  The Ogmios RPC method.
     * @param {object} [params]
     *  Optional parameters for the method.
     * @param {any} [id]
     *  An optional request id.
     *
     * @see {@link https://ogmios.dev/api/}
     *
     * @example
     * ws.once("message", (data) => { ... });
     * ws.rpc('findIntersection', { point: [ "origin" ] }, "my-request-id");
     * @example
     * ws.once("message", (data) => { ... });
     * ws.rpc('queryLedgerState/tip');
     */
    ws.rpc = function (method, params, id) {
      ws.send(newRpcRequest(method, params, id));
    };

    // ------------------------------------------------------------------- Local-State-Query Helpers

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

    /**
     * @memberOf OgmiosWebSocket
     *
     * @description
     *  A short-hand for running a single ledger-state query. If a state has been acquired, then it is ran on
     *  that state. If not, it is ran from the most recent ledger state available.
     *
     * @callback queryLedgerState
     * @param {string} method
     *  The ledger state query name (without "queryLedgerState/").
     * @param {object} [params]
     *  Optional parameters for the query, if any.
     * @return {Promise<any>}
     *  A promise holding the result for that query.
     * @example
     * const tip = await ws.queryLedgerState("tip");
     */
    ws.queryLedgerState = function (method, params) {
      return request(`queryLedgerState/${method}`, params);
    };

    /**
     * @memberOf OgmiosWebSocket
     *
     * @description
     *  A short-hand for running a single network query.
     *
     * @callback queryNetwork
     * @param {string} method
     *  The ledger state query name (without "queryNetwork/").
     * @param {object} [params]
     *  Optional parameters for the query, if any.
     * @return {Promise<any>}
     *  A promise holding the result for that query.
     * @example
     * const startTime = await ws.queryNetwork("startTime");
     */
    ws.queryNetwork = function (method, params) {
      return request(`queryNetwork/${method}`, params);
    };

    // -------------------------------------------------------------------- Local-Chain-Sync helpers

    /**
     * @memberOf OgmiosWebSocket
     *
     * @description
     *  Create a generator of RollForward|RollBackward for following the chain from any given point.
     *
     * @callback newChainFollower
     * @param {Array<OgmiosWebSocket.Point|"origin">} [points]
     *  Points to use for intersection in order to negotiate for an intersection.
     * @param {integer} [count]
     *  Number of blocks to fetch. If omitted, will run indefinitely.
     * @return {OgmiosWebSocket.asyncChainFollower}
     *
     * @example
     * const chainFollower = await ws.newChainFollower();
     *
     * for await (const { block } of chainFollower()) {
     *   console.log(block);
     * }
     *
     * @example
     *  const chainFollower = await ws.newChainFollower(
     *    [
     *      {
     *        id: "3d6f139f9f019668fe0412cacfaeb9e0be42e7b0f6ab21d6bddbc12d771ec18a",
     *        slot: 86268539,
     *      },
     *    ],
     *    1
     *  );
     *
     *  for await (const { block } of chainFollower()) {
     *    console.log(block);
     *  }
     *
     * @see {@link https://ogmios.dev/api/#operation-subscribe-/?NextBlock}
     */
    ws.newChainFollower = async function newChainFollower(start, count) {
      // Sanitize inputs, but allow for shorthand syntax passing only a count.
      if (typeof start === "number" && count == undefined) {
        count = start;
        start = undefined;
      }

      if (start != undefined && !Array.isArray(start)) {
        throw new Error(`expected an Array to start 'start', got something else: ${start}`);
      }

      if (count != undefined && !Number.isInteger(count)) {
        throw new Error(`expected an Integer 'count', got something else: ${count}`);
      }

      // On new block received, notify the consumer.
      function addBlockListener(signals) {
        let ignoredFirstRollBack = false;

        ws.on("message", (data) => {
          const { direction, block } = Json.parse(data).result;

          // First message is always backward, ignore.
          if (direction === "backward" && !ignoredFirstRollBack) {
            ignoredFirstRollBack = true;
            return;
          }

          signals.pop().notify({ direction, block });
        });
      }

      // Enqueue a nextBlock request, and another one if needs be once the former as
      // resolved.
      function enqueue(tasks, signals, again) {
        tasks.unshift(new Promise((resolve) => {
          signals.unshift(again()
            ? ({
                notify(block) {
                  enqueue(tasks, signals, again);
                  resolve(block);
                }
              })
            : ({ notify: resolve })
          );
          ws.rpc("nextBlock");
        }));
      }

      function requestBlocks(tasks, signals) {
        // Pipeline some initial request, up to INITIAL_PIPELINE_BURST but no more than
        // 'count' if 'count' is defined.
        const pipelined = Math.min(
          count ?? INITIAL_PIPELINE_BURST,
          INITIAL_PIPELINE_BURST,
        );

        let n = pipelined;

        for (let i = 0; i <= pipelined; i += 1) {
          // Enqueue a "nextBlock" request, and count how many we've enqueued so far.
          // If needed, enqueue a next one. The lambda we pass to enqueue captures "n"
          // in its closure, so that we can have interior mutability without bothering
          // the "enqueue" function with the explicit management of "n".
          enqueue(tasks, signals, () => {
            n += 1;
            return n <= (count ?? Number.MAX_SAFE_INTEGER);
          });
        }
      }

      const { tasks, signals } = await new Promise((resolve, reject) => {
        const signals = [];
        const tasks = [];

        if (start != undefined) {
          // If an intersection is provided, negotiate that intersection and proceed
          // from there. Provided it is valid.
          ws.once("message", (data) => {
            const { error } = Json.parse(data);

            if (error !== undefined) {
              return reject(error);
            }

            addBlockListener(signals);
            requestBlocks(tasks, signals);
            resolve({ tasks, signals });
          });

          ws.rpc("findIntersection", { points: start });
        } else {
          // If no intersection is provided, find the tip and negotiate an intersection
          // from the tip.
          ws.once("message", (data) => {
            const { tip } = Json.parse(data).result;
            ws.once("message", (data) => {
              addBlockListener(signals);
              requestBlocks(tasks, signals);
              resolve({ tasks, signals });
            });
            ws.rpc("findIntersection", { points: [tip] });
          });

          ws.rpc("nextBlock");
        }
      });

      /**
       * @memberOf OgmiosWebSocket
       * @function asyncChainFollower
       * @generator
       * @async
       * @description
       *  Yields roll-forward or roll-backward events from a node. This generator terminates after
       *  yielding all the requested blocks (count) or never if following the chain indefinitely.
       * @returns {Promise<RollForward|RollBackward>}
       * @see {@link https://ogmios.dev/api/#operation-subscribe-/?NextBlock}
       */
      return async function * () {
        if (count != undefined) {
          for (let i = 0; i < count; i += 1) {
            yield await tasks.pop();
          }
          // Clear up the last promise corresponding to the first rollback,
          // to avoid dangling promises. Although, yield no result for that one.
          signals.pop().notify();
          await tasks.pop();
        } else {
          // When no count is provided, we effectively have an infinite generator.
          // Requests are properly pipelined, so we can simply wait for the next task
          // to be resolved. At any point in time, we have INITIAL_PIPELINE_BURST + 1
          // tasks pending.
          let block;
          while (block = await tasks.pop()) {
            yield block
          }
        }
      };
    }
  });
}

/**
 * @memberOf OgmiosWebSocket
 *
 * @typedef Point
 * @description
 *  A point on chain.
 * @type {object}
 * @property {string} id
 *  A base-16 encoded header hash.
 * @property {integer} slot
 *  An absolute slot number.
 */
