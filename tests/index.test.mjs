import test from "ava";
import { ogmios, Json } from "../lib/index.mjs";

test("🎉 query tip", async (t) => {
  const result = await ogmios((ws, done) => {
    ws.once("message", (data) => {
      done(Json.parse(data).result);
    });

    ws.rpc("queryLedgerState/tip");
  });

  t.is(typeof result.id, "string");
  t.is(typeof result.slot, "number");
});

test("☠️ non-existing connection", async (t) => {
  await t.throwsAsync(() => ogmios((_, done) => done(), "ws://127.0.0.1:1234"), {
    any: true,
    message: /connect ECONNREFUSED/,
  });
});
