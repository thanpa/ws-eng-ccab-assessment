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

async function raceConditionTest() {
    try {
      await app.post("/reset").send({"account": "test"}).expect(204);

      const numberOfRequests = 10;
      const promises = Array.from({ length: numberOfRequests }, () => {
        return app.post('/charge')
          .send({
            "account": "test",
            "charges": 15
          })
          .expect(200);
      });
      const responses = await Promise.all(promises);

      const errorMessage = "The balance was changed between calls, please retry";
      const hasErrorMessage = responses.some(response => response.body.error === errorMessage);
  
      assert(hasErrorMessage, `None of the responses contain the error message: ${errorMessage}`);
  
      console.log('Test passed!');
    } catch (error) {
      console.error('Test failed:', error);
    }
  }
  
async function runTests() {
    await basicLatencyTest();
    await chargeTest();
    await chargeFailsWhenNoBalanceTest();
    await raceConditionTest();
}

runTests().catch(console.error);
