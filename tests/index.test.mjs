import test from "ava";
import { ogmios, Json } from "../lib/index.mjs";

test("🎉 fetch tip", async (t) => {
  const response = await ogmios((ws, done) => {
    ws.once("message", (data) => {
      done(Json.parse(data));
    });

    ws.rpc("findIntersection", { points: ["origin"] }, "myRequest");
  });

  t.is(typeof response.result.tip.id, "string");
  t.is(typeof response.result.tip.slot, "number");
  t.is(response.id, "myRequest");
});

test("🎉 query tip", async (t) => {
  const tip = await ogmios((ws, done) => {
    ws.queryLedgerState("tip").then(done);
  });

  t.is(typeof tip.id, "string");
  t.is(typeof tip.slot, "number");
});

test("🎉 query network", async (t) => {
  const time = await ogmios((ws, done) => {
    ws.queryNetwork("startTime").then(done);
  });

  t.true(Number.isInteger(Date.parse(time)));
});

test("🎉 fetch child block", async (t) => {
  const child = await ogmios(async (ws, done) => {
    const chainFollower = await ws.newChainFollower(
      [
        {
          id: "3d6f139f9f019668fe0412cacfaeb9e0be42e7b0f6ab21d6bddbc12d771ec18a",
          slot: 86268539,
        },
      ],
      1,
    );

    for await (const { block } of chainFollower()) {
      done(block);
    }
  });

  t.is(child.id, "3d339c834346ec80ed08e67e4d0910c605ea9afdec39ed1c19e57944341517ce");
});

test("🎉 await next block (unlimited)", async (t) => {
  t.timeout(120 * 1000, "no new block produced within a 2min timeframe...");

  const tip = await ogmios(async (ws, done) => {
    const chainFollower = await ws.newChainFollower();
    for await (const { block } of chainFollower()) {
      done(block);
    }
  });

  t.is(typeof tip.id, "string");
  t.is(typeof tip.slot, "number");
});

test("🎉 await next block (only one)", async (t) => {
  t.timeout(120 * 1000, "no new block produced within a 2min timeframe...");

  const tip = await ogmios(async (ws, done) => {
    const chainFollower = await ws.newChainFollower(1);
    for await (const { block } of chainFollower()) {
      done(block);
    }
  });

  t.is(typeof tip.id, "string");
  t.is(typeof tip.slot, "number");
});

test("☠️ invalid query", async (t) => {
  const result = await ogmios(async (ws, done) => {
    try {
      await ws.queryLedgerState("foo");
      done("success");
    } catch (_) {
      done("failure");
    }
  });

  t.is(result, "failure");
});

test("☠️ non-existing connection", async (t) => {
  await t.throwsAsync(() => ogmios((_, done) => done(), "ws://127.0.0.1:1234"), {
    any: true,
    message: /connect ECONNREFUSED/,
  });
});

test("☠️ invalid newChainFollower start", async (t) => {
  await t.throwsAsync(
    async () => {
      const error = await ogmios(async (ws, done) => {
        try {
          await ws.newChainFollower("foo", 42);
          done();
        } catch (e) {
          done(e);
        }
      });

      if (error) {
        throw error;
      }
    },
    {
      any: true,
      message: /expected an Array/,
    },
  );
});

test("☠️ invalid newChainFollower count", async (t) => {
  await t.throwsAsync(
    async () => {
      const error = await ogmios(async (ws, done) => {
        try {
          await ws.newChainFollower(["origin"], "bar");
          done();
        } catch (e) {
          done(e);
        }
      });

      if (error) {
        throw error;
      }
    },
    {
      any: true,
      message: /expected an Integer/,
    },
  );
});

test("☠️ invalid newChainFollower intersection", async (t) => {
  await t.throwsAsync(
    async () => {
      const error = await ogmios(async (ws, done) => {
        try {
          await ws.newChainFollower([{ id: "0000", slot: 0 }]);
          done();
        } catch (e) {
          done(e);
        }
      });

      if (error) {
        throw error;
      }
    },
    {
      any: true,
      message: /Invalid request/,
    },
  );
});
