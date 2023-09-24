import { performance } from "perf_hooks";
import supertest from "supertest";
import { buildApp } from "./app";
const assert = require('assert').strict;

const app = supertest(buildApp());

async function basicLatencyTest() {
    await app.post("/reset").expect(204);
    const start = performance.now();
    await app.post("/charge").expect(200);
    await app.post("/charge").expect(200);
    await app.post("/charge").expect(200);
    await app.post("/charge").expect(200);
    await app.post("/charge").expect(200);
    console.log(`Latency: ${performance.now() - start} ms`);
}

async function chargeTest() {
    await app.post("/reset").send({"account": "test"}).expect(204); // Set the balance to 100
    const response = await app.post("/charge").send({
        "account": "test",
        "charges": 15
    }).expect(200);
    assert.strictEqual(response.body.remainingBalance, 85, "Property does not match expected value");
}

async function chargeFailsWhenNoBalanceTest() {
    await app.post("/reset").send({"account": "test"}).expect(204); // Set the balance to 100
    await app.post("/charge").send({
        "account": "test",
        "charges": 90
    }).expect(200); // Reduce balance to 10
    const response = await app.post("/charge").send({
        "account": "test",
        "charges": 11
    }).expect(200); // Try to charge 11, while only 10 is available
    assert.strictEqual(response.body.remainingBalance, 10, "Property does not match expected value");
}

async function runTests() {
    await basicLatencyTest();
    await chargeTest();
    await chargeFailsWhenNoBalanceTest();
}

runTests().catch(console.error);
