# Ogmios - Minimal Development Kit

[![Licence](https://img.shields.io/github/license/CardanoSolutions/ogmios-mdk?style=for-the-badge)](https://github.com/CardanoSolutions/ogmios-mdk/blob/main/LICENSE)
[![NPM](https://img.shields.io/npm/v/%40cardano-ogmios%2Fmdk?style=for-the-badge)](https://www.npmjs.com/package/@cardano-ogmios/mdk)

A minimalist development kit in JavaScript for Ogmios.

## Installation

```
yarn add @cardano-ogmios/mdk
```

## Usage

```js
import { ogmios, Json } from '@cardano-ogmios/mdk';

const result = await ogmios((ws, done) => {
  ws.once('message', (data) => {
    done(Json.parse(data).result);
  });

  ws.rpc('queryLedgerState/tip');
});

console.log(Json.stringify(result));
```
