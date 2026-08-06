export type Vec3 = [number, number, number];

export interface CandidatePlayback {
  candidate_id: string;
  formula: string;
  role: string;
  realization: "DETERMINISTIC" | "STOCHASTIC_MEAN";
  resultant: Vec3;
  resultant_norm: number;
  torque: Vec3;
  torque_norm: number;
}

export interface CandidateFamilyPacket {
  schema_version: "1.0";
  packet_id: "R6_BODY_RESPONSE_CANDIDATE_FAMILY_A1_1_BROWSER_PLAYBACK_V1";
  authority: "READ_ONLY_GOVERNED_PUBLIC_PROJECTION";
  scientific_head: string;
  pull_request: number;
  workflow_run: number;
  artifact_id: number;
  artifact_sha256: string;
  packet_npz_sha256: string;
  summary_sha256: string;
  manifest_sha256: string;
  main_verdict: "MINIMAL_CONTROL_FAMILY_CONTAINS_EXACT_ZERO";
  secondary_verdict: "NONFORWARD_CONTROL_HULL_EXCLUDES_ZERO";
  candidate_source_class: "PROJECT_CONSTITUTIVE_CANDIDATES_NOT_VIKTOR_LAW";
  candidate_order: string[];
  candidates: CandidatePlayback[];
  hulls: {
    all_resultant: { contains_zero: true; minimum_distance: number; weights: number[] };
    all_joint: { contains_zero: true; minimum_distance: number; weights: number[] };
    nonforward_resultant: { contains_zero: false; minimum_distance: number; weights: number[] };
    nonforward_joint: { contains_zero: false; minimum_distance: number; weights: number[] };
  };
  metrics: Record<string, number>;
  logical_delta: {
    forward_transmission_reaches_exact_zero: true;
    nonzero_full_residual_forced_by_minimal_principles: false;
    interpretation: string;
  };
  claim_ceiling: {
    candidate_family_is_project_level: true;
    routing_law_selected: false;
    first_scientific_viktor_residual: false;
    physical_seconds_required: false;
    si_time_force_binding: "DEFERRED";
    upor: false;
    dipole: false;
    scale_binding: false;
    validation: false;
    canon_promotion: false;
  };
}

const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;

function required(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Candidate family packet: ${message}`);
}

function finite(value: unknown, name: string): asserts value is number {
  required(typeof value === "number" && Number.isFinite(value), `${name} must be finite`);
}

function vec3(value: unknown, name: string): asserts value is Vec3 {
  required(Array.isArray(value) && value.length === 3, `${name} must be Vec3`);
  value.forEach((component, index) => finite(component, `${name}[${index}]`));
}

export function parseCandidateFamilyPacket(value: unknown): CandidateFamilyPacket {
  required(value !== null && typeof value === "object" && !Array.isArray(value), "root must be object");
  const packet = value as CandidateFamilyPacket;
  required(packet.schema_version === "1.0", "schema mismatch");
  required(packet.packet_id === "R6_BODY_RESPONSE_CANDIDATE_FAMILY_A1_1_BROWSER_PLAYBACK_V1", "packet id mismatch");
  required(packet.authority === "READ_ONLY_GOVERNED_PUBLIC_PROJECTION", "authority mismatch");
  required(SHA40.test(packet.scientific_head), "scientific head invalid");
  for (const [name, hash] of Object.entries({ artifact: packet.artifact_sha256, npz: packet.packet_npz_sha256, summary: packet.summary_sha256, manifest: packet.manifest_sha256 })) {
    required(SHA64.test(hash), `${name} hash invalid`);
  }
  required(packet.main_verdict === "MINIMAL_CONTROL_FAMILY_CONTAINS_EXACT_ZERO", "main verdict mismatch");
  required(packet.secondary_verdict === "NONFORWARD_CONTROL_HULL_EXCLUDES_ZERO", "secondary verdict mismatch");
  required(packet.candidate_source_class === "PROJECT_CONSTITUTIVE_CANDIDATES_NOT_VIKTOR_LAW", "source class mismatch");
  required(packet.candidate_order.join(",") === "C0_FORWARD_TRANSMISSION,C1_GLOBAL_ISOTROPIC_REEMISSION,C2_UNIFORM_OUTWARD_HEMISPHERE,C3_OUTWARD_NORMAL,C4_SPECULAR", "candidate order mismatch");
  required(packet.candidates.length === 5, "five candidates required");
  packet.candidates.forEach((candidate, index) => {
    required(candidate.candidate_id === packet.candidate_order[index], `candidate ${index} id mismatch`);
    vec3(candidate.resultant, `candidate ${index} resultant`);
    vec3(candidate.torque, `candidate ${index} torque`);
    finite(candidate.resultant_norm, `candidate ${index} resultant norm`);
    finite(candidate.torque_norm, `candidate ${index} torque norm`);
    required(Math.abs(Math.hypot(...candidate.resultant) - candidate.resultant_norm) <= 1e-12, `candidate ${index} resultant norm mismatch`);
    required(Math.abs(Math.hypot(...candidate.torque) - candidate.torque_norm) <= 1e-12, `candidate ${index} torque norm mismatch`);
  });
  required(packet.candidates[0]!.resultant_norm <= 5e-12, "forward zero resultant failed");
  required(packet.candidates[0]!.torque_norm <= 5e-12, "forward zero torque failed");
  required(packet.hulls.all_resultant.contains_zero === true, "all resultant hull must contain zero");
  required(packet.hulls.all_joint.contains_zero === true, "all joint hull must contain zero");
  required(packet.hulls.nonforward_resultant.contains_zero === false, "nonforward resultant hull must exclude zero");
  required(packet.hulls.nonforward_joint.contains_zero === false, "nonforward joint hull must exclude zero");
  required(packet.hulls.all_resultant.minimum_distance <= 5e-12, "all resultant minimum too large");
  required(packet.hulls.all_joint.minimum_distance <= 5e-12, "all joint minimum too large");
  required(packet.hulls.nonforward_resultant.minimum_distance > 0.4, "nonforward resultant lower bound missing");
  required(packet.logical_delta.forward_transmission_reaches_exact_zero === true, "forward logical delta missing");
  required(packet.logical_delta.nonzero_full_residual_forced_by_minimal_principles === false, "nonzero-force ceiling missing");
  required(packet.claim_ceiling.candidate_family_is_project_level === true, "project-level class missing");
  required(packet.claim_ceiling.routing_law_selected === false, "routing-law overclaim");
  required(packet.claim_ceiling.first_scientific_viktor_residual === false, "Viktor residual overclaim");
  required(packet.claim_ceiling.physical_seconds_required === false, "relational-time ceiling mismatch");
  required(packet.claim_ceiling.si_time_force_binding === "DEFERRED", "SI binding mismatch");
  required(packet.claim_ceiling.upor === false && packet.claim_ceiling.dipole === false, "Upor/dipole firewall missing");
  required(packet.claim_ceiling.scale_binding === false && packet.claim_ceiling.validation === false, "scale/validation firewall missing");
  required(packet.claim_ceiling.canon_promotion === false, "canon firewall missing");
  return structuredClone(packet);
}
