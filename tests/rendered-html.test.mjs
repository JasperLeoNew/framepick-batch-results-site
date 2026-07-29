import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the FramePick archive shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>FramePick Archive \| 拼图模板终判档案<\/title>/i);
  assert.match(html, /500 个模板的拼图候选终判/);
  assert.match(html, /aria-label="批次数据概览"/);
  assert.match(html, /aria-label="有效槽位统计与筛选"/);
  assert.match(html, /aria-label="有效槽位筛选"/);
  assert.match(html, /1–5 槽/);
  assert.match(html, /20\+ 槽/);
});

test("keeps batch totals and slot buckets internally consistent", async () => {
  const payload = JSON.parse(
    await readFile(
      new URL("../public/data/results.json", import.meta.url),
      "utf8",
    ),
  );

  assert.equal(payload.items.length, payload.batch.counts.total);
  assert.equal(payload.batch.counts.total, 500);
  assert.equal(
    payload.batch.counts.yes +
      payload.batch.counts.no +
      payload.batch.counts.unjudgeable +
      payload.batch.counts.pending,
    payload.batch.counts.total,
  );

  const slotCounts = payload.items.map((item) => item.metrics.effectiveSlots);
  const buckets = [
    slotCounts.filter((value) => value === 0).length,
    slotCounts.filter((value) => value >= 1 && value <= 5).length,
    slotCounts.filter((value) => value >= 6 && value <= 9).length,
    slotCounts.filter((value) => value >= 10 && value <= 19).length,
    slotCounts.filter((value) => value >= 20).length,
  ];

  assert.deepEqual(buckets, [71, 94, 136, 122, 77]);
  assert.equal(buckets.reduce((sum, value) => sum + value, 0), 500);
  assert.equal(Math.max(...slotCounts), 40);
});

test("implements slot filtering as a first-class result filter", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /const slotFilterOptions = \[/);
  assert.match(page, /function matchesSlotFilter/);
  assert.match(page, /const \[slotFilter, setSlotFilter\]/);
  assert.match(page, /decisionFiltered\.filter\(\(item\) => matchesSlotFilter/);
  assert.match(page, /role="tablist" aria-label="有效槽位筛选"/);
});
