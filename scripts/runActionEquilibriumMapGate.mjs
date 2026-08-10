import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const path = new URL("../public/packets/R14_V14J_ACTION_EQUILIBRIUM_ATLAS_BROWSER_PACKET_V1.json", import.meta.url);
const bytes = readFileSync(path);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const expectedSha256 = "bb87cd176b7e5edd163bdb71eb610993144046c59dfeb6229039e69513d3a944";
if (sha256 !== expectedSha256) throw new Error(`A5 packet SHA mismatch: ${sha256}`);

const packet = JSON.parse(bytes.toString("utf8"));
const require = (condition, message) => { if (!condition) throw new Error(message); };
require(packet.schema === "VOXELLAB_V14J_AXIAL_EQUILIBRIUM_ATLAS_COMPACT_V1", "wrong A5 schema");
require(packet.source.head === "12e0900a6cf83a9bb9ca4b57972c325e14597d7c", "wrong V14J source HEAD");
require(packet.frames.length === 12, "A5 frame count drift");
require(packet.sampling.count === 41 && packet.sampling.sourceCount === 121 && packet.sampling.stride === 3, "A5 projection contract drift");
require(packet.status.w1AsPhysicalSourceForce === "NOT_YET_ESTABLISHED", "force claim ceiling removed");
require(packet.status.full2d3dFixedPointClass === "BLOCKED_UNTIL_TRANSVERSE_VECTOR_FIELD", "3D classification blocker removed");
require(packet.status.lateComponentLabels === "OFF_BY_DEFAULT", "late component labels must stay hidden by default");

for (const frame of packet.frames) {
  for (const channel of ["finite", "nearest", "density"]) {
    const decoded = Buffer.from(frame[channel], "base64");
    require(decoded.length === packet.sampling.count * 2, `${channel} length mismatch at t=${frame.t}`);
  }
  for (const closure of ["finite", "nearest"]) {
    const roots = frame.roots[closure];
    require(roots.left?.kind === "converging", `${closure} left branch drift at t=${frame.t}`);
    require(roots.center?.kind === "diverging", `${closure} centre branch drift at t=${frame.t}`);
    require(roots.right?.kind === "converging", `${closure} right branch drift at t=${frame.t}`);
  }
}

const t60 = packet.frames.find(frame => frame.t === 60);
require(t60, "t=60 frame missing");
require(Math.abs(t60.roots.finite.left.s + 7.558241149549) < 1e-12, "t=60 left root drift");
require(Math.abs(t60.roots.finite.center.s - 1.467880553726) < 1e-12, "t=60 centre root drift");
require(Math.abs(t60.roots.finite.right.s - 8.804056702952) < 1e-12, "t=60 right root drift");
require(packet.frames.some(frame => frame.componentCount === 2), "temporary density split label missing");
require(packet.frames.at(-1).componentCount === 1, "density remerge label missing");

console.log(JSON.stringify({
  verdict: "A5_V14J_AXIAL_EQUILIBRIUM_ATLAS_PACKET_PASS",
  sha256,
  sourceHead: packet.source.head,
  frames: packet.frames.length,
  topology: "CONVERGING_DIVERGING_CONVERGING",
  claimCeiling: packet.status.claimCeiling,
  sourceForce: packet.status.w1AsPhysicalSourceForce,
  full2d3dClass: packet.status.full2d3dFixedPointClass
}, null, 2));
