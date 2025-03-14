# Ogmios - Minimal Development Kit

[![Licence](https://img.shields.io/github/license/CardanoSolutions/ogmios-mdk?style=for-the-badge)](https://github.com/CardanoSolutions/ogmios-mdk/blob/main/LICENSE)
[![NPM](https://img.shields.io/npm/v/%40cardano-ogmios%2Fmdk?style=for-the-badge)](https://www.npmjs.com/package/@cardano-ogmios/mdk)

A minimalist development kit in JavaScript for Ogmios.

## Installation

```
yarn add @cardano-ogmios/mdk
```

## Usage

### General usage

```js
import { ogmios, Json } from "@cardano-ogmios/mdk";

const tip = await ogmios((ws, done) => {
  ws.once("message", (data) => {
    done(Json.parse(data).result.tip)
  });

  ws.rpc("findIntersection", { points: [ "origin" ] });
});

console.log(tip);
```

### Simple state-query

```js
import { ogmios, Json } from "@cardano-ogmios/mdk";

const result = await ogmios((ws, done) => {
  ws.queryLedgerState("tip").then(done);
});

console.log(Json.stringify(result));
```

### Get a particular block child

```js
import { ogmios, Json } from "@cardano-ogmios/mdk";

await ogmios(async (ws, done) => {
  const chainFollower = await ws.newChainFollower(
    [
      {
        id: "3d6f139f9f019668fe0412cacfaeb9e0be42e7b0f6ab21d6bddbc12d771ec18a",
        slot: 86268539,
      },
    ],
    1
  );

  for await (const { block } of chainFollower()) {
    console.log(block);
  }

  done();
});
```

### Follow the chain from the tip

```js
import { ogmios, Json } from "@cardano-ogmios/mdk";

await ogmios(async (ws, done) => {
  const chainFollower = await ws.newChainFollower();

  for await (const { block } of chainFollower()) {
    console.log(block);
  }

  done();
});
```

