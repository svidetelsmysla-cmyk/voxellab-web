import { runA4MethodGate } from "../src/actionLab/continuousFieldActionBridge";

const receipt = runA4MethodGate();
if (receipt.methodVerdict !== "A4_K2_CONTINUOUS_FIELD_METHOD_PARITY_PASS") {
  throw new Error(`A4 method gate blocked: ${JSON.stringify(receipt.gates.filter((gate) => !gate.pass))}`);
}

console.log(JSON.stringify(receipt, null, 2));
