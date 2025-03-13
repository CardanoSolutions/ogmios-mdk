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

/** @module safe_json
 * @private
 */

import JsonBig from "@cardanosolutions/json-bigint";

/** @private */
const $ = JsonBig({ useNativeBigInt: true });

export const Json = {
  parse(str) {
    try {
      return sanitize($.parse(str));
    } catch (e) {
      if (
        e.name === "SyntaxError" &&
        typeof e.message === "string" &&
        e.message.includes("forbidden constructor")
      ) {
        const escaped = str.toString().replace(/"constructor"/g, '"constr"');
        return sanitize($.parse(escaped));
      }
      throw e;
    }
  },

  stringify(...args) {
    return $.stringify(...args);
  },
};

/** `sanitize` does a second pass after parsing, to convert into BigInt fields which should indeed be parsed
 * as BigInt.
 *
 * Note that, this is potentially _slow_ since it needs to traverse the entire JSON.
 *
 * @private
 */
function sanitize(json, parentKey) {
  if (typeof json === "object" && json !== null) {
    // Lovelace
    if (json.lovelace !== undefined) {
      return sanitizeFields(json, ["lovelace"]);
    }

    // AssetQuantity
    if (json.ada !== undefined || parentKey === "mint" || parentKey === "value") {
      return sanitizeAdditionalFields(json, 2);
    }

    // Script
    if (json.clause === "some" && json.atLeast !== undefined) {
      sanitizeFields(json, ["atLeast"]);
      return sanitize(json.from, "from");
    }

    // Metadata
    if (parentKey === "labels") {
      return sanitizeMetadatum(json);
    }

    // Otherwise...
    for (const k in json) {
      sanitize(json[k], k);
    }
  }

  return json;
}

/**
 * Recursively sanitize an object and its nested fields, making sure to sanitize top-level fields given as parameter.
 *
 * @private
 */
function sanitizeFields(json, fields) {
  for (const k in json) {
    const v = json[k];
    if (fields.includes(k)) {
      json[k] = typeof v === "number" ? BigInt(v) : v;
    } else {
      sanitize(v, k);
    }
  }
  return json;
}

/** @private */
function sanitizeAdditionalFields(json, depth) {
  for (const k in json) {
    const v = json[k];
    if (depth > 1) {
      sanitizeAdditionalFields(v, depth - 1);
    } else {
      json[k] = typeof v === "number" ? BigInt(v) : v;
    }
  }
  return json;
}

/** @private */
function sanitizeMetadatum(json) {
  if (typeof json === "object" && json !== null) {
    for (const k in json) {
      const v = json[k];
      json[k] = typeof v === "number" ? BigInt(v) : sanitizeMetadatum(v);
    }
  }
  return json;
}
