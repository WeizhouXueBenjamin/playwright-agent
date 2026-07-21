const assert = require("node:assert/strict");

const { RecoveryEngine } = require("./recovery-engine");

const engine = new RecoveryEngine({ interactionStability: { timeoutMs: 1 } });

assert.equal(typeof engine.recover, "function");
assert.equal(Object.prototype.hasOwnProperty.call(engine, "retryPolicy"), false);

console.log("recovery engine tests passed");
