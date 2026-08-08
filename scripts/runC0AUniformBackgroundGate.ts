import {
  auditIndependentSphereSampler,
  buildB0ContinuumOracle,
  classifyC0ARefinement,
  defaultC0AFixture,
  runC0ARelaxation,
  type C0ARunReceipt,
} from "../src/actionLab/c0aUniformBackground";

const nValues = [96, 192, 384, 768, 1536] as const;
const cache = new Map<string, C0ARunReceipt>();

function run(N: number, iterations: number, softening: number): C0ARunReceipt {
  const key = `${N}:${iterations}:${softening}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const result = runC0ARelaxation(defaultC0AFixture(N, iterations, softening));
  cache.set(key, result);
  return result;
}

const samplerAudits = nValues.map((N) => auditIndependentSphereSampler(N));
const continuumOracle = buildB0ContinuumOracle();
if (!samplerAudits.every((audit) => audit.pass) || !continuumOracle.pass) {
  throw new Error("C0A pre-relaxation sampler/oracle gate failed; runtime blocked by preregistration");
}

const primaryNLadder = nValues.map((N) => run(N, 160, 0.32));
const iterationRefinement = [160, 320, 640].map((iterations) => run(384, iterations, 0.32));
const secondarySofteningControl = [0.16, 0.08].map((softening) => run(384, 320, softening));

const receipt = classifyC0ARefinement(
  samplerAudits,
  continuumOracle,
  primaryNLadder,
  iterationRefinement,
  secondarySofteningControl,
);

console.log(JSON.stringify(receipt, null, 2));
