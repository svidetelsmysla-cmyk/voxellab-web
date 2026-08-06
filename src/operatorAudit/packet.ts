export type Vec3 = [number, number, number];

export type OperatorLaneId = "S0" | "S1" | "S2" | "S3";

export interface OperatorLane {
  id: OperatorLaneId;
  name: string;
  a_minus_b_norm: number | null;
  source_class: string;
  status: "EXACT_ZERO" | "NONZERO_OPERATOR_DELTA" | "NOT_OPENED";
}

export interface RefinementRow {
  directions: number;
  delta_d0: number;
  delta_d1_norm: number;
  owner_change_fraction: number;
}

export interface ProjectionRow {
  axis: string;
  universal: [number, number];
  outward_hemisphere_outer: [number, number];
  contains_zero: boolean;
}

export interface OperatorAuditPacket {
  schema_version: "1.0";
  packet_id: "R6_OPERATOR_AUDIT_A1_BROWSER_PLAYBACK_V1";
  authority: "READ_ONLY_GOVERNED_PUBLIC_PROJECTION";
  scientific_sources: {
    source_additive_vs_first_hit: {
      head: string;
      pull_request: number;
      workflow_run: number;
      artifact_id: number;
      artifact_sha256: string;
      public_projection_sha256: string;
      manifest_sha256: string;
    };
    event_geometry_reachable_set: {
      head: string;
      pull_request: number;
      workflow_run: number;
      artifact_id: number;
      artifact_sha256: string;
    };
    source_audit: {
      report_commit: string;
      decision_commit: string;
      context_commit: string;
    };
  };
  main_verdict: "ADDITIVE_SOURCE_ZERO_FIRST_HIT_NONZERO_OPERATOR_DELTA_PASS";
  secondary_verdict: "FIRST_HIT_DIRECT_SUPPORT_IS_BINARY_ANGULAR_COVERAGE_NOT_WQN_ACTION";
  source_audit_verdict: "SOURCE_REDIRECTION_CONSTITUTIVE_LAW_NOT_FOUND";
  event_geometry_verdict: "FIRST_HIT_EVENT_GEOMETRY_EXPORT_PASS_SOURCE_KERNEL_UNDERDETERMINED";
  matched_pair: {
    receiver: Vec3;
    centres: Vec3[];
    amounts: number[];
    radii_a: number[];
    radii_b: number[];
    densities_a: number[];
    densities_b: number[];
    standard_isofield_null: number;
  };
  lanes: OperatorLane[];
  first_hit: {
    direction_count: number;
    delta_d0: number;
    delta_d1: Vec3;
    delta_d1_norm: number;
    owner_change_fraction: number;
    amount_scale_parity_residual: number;
    consumes_source_amount: false;
    consumes_source_distance: false;
    consumes_chord_length: false;
    consumes_density: false;
    consumes: string[];
  };
  refinement: RefinementRow[];
  volume_cubature_control: {
    authority: "LOW_ORDER_NONMONOTONIC_NUMERICAL_CONTROL";
    rows: Array<{
      samples_per_sphere: number;
      branch_a_error: number;
      branch_b_error: number;
      a_minus_b_norm: number;
    }>;
  };
  reachable_set: {
    joint_source_constrained_zero_membership: "NOT_IDENTIFIED";
    reason: string;
    projection_rows: ProjectionRow[];
  };
  source_classes: {
    source_locked: string[];
    not_source_locked: string[];
  };
  claim_ceiling: {
    dimensionless_operator_delta: true;
    first_scientific_viktor_residual: false;
    routing_law_selected: false;
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
  if (!condition) throw new Error(`Operator Audit A1 packet: ${message}`);
}

function finite(value: unknown, name: string): asserts value is number {
  required(typeof value === "number" && Number.isFinite(value), `${name} must be finite`);
}

function vec3(value: unknown, name: string): asserts value is Vec3 {
  required(Array.isArray(value) && value.length === 3, `${name} must be Vec3`);
  value.forEach((component, index) => finite(component, `${name}[${index}]`));
}

export function parseOperatorAuditPacket(value: unknown): OperatorAuditPacket {
  required(value !== null && typeof value === "object" && !Array.isArray(value), "root must be object");
  const packet = value as OperatorAuditPacket;
  required(packet.schema_version === "1.0", "schema version mismatch");
  required(packet.packet_id === "R6_OPERATOR_AUDIT_A1_BROWSER_PLAYBACK_V1", "packet id mismatch");
  required(packet.authority === "READ_ONLY_GOVERNED_PUBLIC_PROJECTION", "authority mismatch");
  required(packet.main_verdict === "ADDITIVE_SOURCE_ZERO_FIRST_HIT_NONZERO_OPERATOR_DELTA_PASS", "main verdict mismatch");
  required(packet.secondary_verdict === "FIRST_HIT_DIRECT_SUPPORT_IS_BINARY_ANGULAR_COVERAGE_NOT_WQN_ACTION", "secondary verdict mismatch");
  required(packet.source_audit_verdict === "SOURCE_REDIRECTION_CONSTITUTIVE_LAW_NOT_FOUND", "source-audit verdict mismatch");
  required(packet.event_geometry_verdict === "FIRST_HIT_EVENT_GEOMETRY_EXPORT_PASS_SOURCE_KERNEL_UNDERDETERMINED", "event-geometry verdict mismatch");

  const source = packet.scientific_sources.source_additive_vs_first_hit;
  const geometry = packet.scientific_sources.event_geometry_reachable_set;
  const sourceAudit = packet.scientific_sources.source_audit;
  required(SHA40.test(source.head), "source discriminator head invalid");
  required(SHA64.test(source.artifact_sha256), "source discriminator artifact hash invalid");
  required(SHA64.test(source.public_projection_sha256), "public projection hash invalid");
  required(SHA64.test(source.manifest_sha256), "manifest hash invalid");
  required(SHA40.test(geometry.head), "event-geometry head invalid");
  required(SHA64.test(geometry.artifact_sha256), "event-geometry artifact hash invalid");
  required(SHA40.test(sourceAudit.report_commit), "source audit report commit invalid");
  required(SHA40.test(sourceAudit.decision_commit), "source audit decision commit invalid");
  required(SHA40.test(sourceAudit.context_commit), "context commit invalid");

  vec3(packet.matched_pair.receiver, "matched_pair.receiver");
  required(packet.matched_pair.centres.length === 3, "three source centres required");
  packet.matched_pair.centres.forEach((point, index) => vec3(point, `matched_pair.centres[${index}]`));
  for (const field of ["amounts", "radii_a", "radii_b", "densities_a", "densities_b"] as const) {
    const values = packet.matched_pair[field];
    required(Array.isArray(values) && values.length === 3, `${field} must contain three values`);
    values.forEach((item, index) => {
      finite(item, `${field}[${index}]`);
      required(item > 0, `${field}[${index}] must be positive`);
    });
  }
  finite(packet.matched_pair.standard_isofield_null, "standard_isofield_null");
  required(Math.abs(packet.matched_pair.standard_isofield_null) <= 1e-12, "standard-isofield null failed");

  required(packet.lanes.length === 4, "four operator lanes required");
  required(packet.lanes.map(lane => lane.id).join(",") === "S0,S1,S2,S3", "lane order mismatch");
  required(packet.lanes[0]?.a_minus_b_norm === 0, "S0 must be exact zero");
  required(packet.lanes[1]?.a_minus_b_norm === 0, "S1 must be exact zero");
  required((packet.lanes[2]?.a_minus_b_norm ?? 0) > 0.4, "S2 nonzero operator delta missing");
  required(packet.lanes[3]?.a_minus_b_norm === null, "S3 must remain unopened");

  vec3(packet.first_hit.delta_d1, "first_hit.delta_d1");
  finite(packet.first_hit.delta_d1_norm, "first_hit.delta_d1_norm");
  required(Math.abs(Math.hypot(...packet.first_hit.delta_d1) - packet.first_hit.delta_d1_norm) <= 1e-12, "Delta D1 norm mismatch");
  required(packet.first_hit.direction_count === 49152, "fine direction count mismatch");
  required(packet.first_hit.consumes_source_amount === false, "first-hit source-amount firewall missing");
  required(packet.first_hit.consumes_source_distance === false, "first-hit source-distance firewall missing");
  required(packet.first_hit.consumes_chord_length === false, "first-hit chord firewall missing");
  required(packet.first_hit.consumes_density === false, "first-hit density firewall missing");

  required(packet.refinement.length === 5, "five refinement levels required");
  for (let index = 0; index < packet.refinement.length; index += 1) {
    const row = packet.refinement[index];
    required(row !== undefined, `refinement[${index}] missing`);
    finite(row.delta_d0, `refinement[${index}].delta_d0`);
    finite(row.delta_d1_norm, `refinement[${index}].delta_d1_norm`);
    finite(row.owner_change_fraction, `refinement[${index}].owner_change_fraction`);
    if (index > 0) required(row.directions > packet.refinement[index - 1]!.directions, "refinement counts must increase");
  }

  required(packet.volume_cubature_control.authority === "LOW_ORDER_NONMONOTONIC_NUMERICAL_CONTROL", "volume-control authority mismatch");
  required(packet.reachable_set.joint_source_constrained_zero_membership === "NOT_IDENTIFIED", "reachable-set ceiling missing");
  required(packet.reachable_set.projection_rows.length === 3, "three projection rows required");
  packet.reachable_set.projection_rows.forEach((row, index) => {
    required(row.universal[0] <= 0 && row.universal[1] >= 0, `projection ${index} universal interval must contain zero`);
    required(row.outward_hemisphere_outer[0] <= 0 && row.outward_hemisphere_outer[1] >= 0, `projection ${index} outward interval must contain zero`);
    required(row.contains_zero === true, `projection ${index} zero flag mismatch`);
  });

  required(packet.claim_ceiling.dimensionless_operator_delta === true, "dimensionless delta must remain available");
  required(packet.claim_ceiling.first_scientific_viktor_residual === false, "Viktor residual overclaim");
  required(packet.claim_ceiling.routing_law_selected === false, "routing-law overclaim");
  required(packet.claim_ceiling.physical_seconds_required === false, "relational-time scope mismatch");
  required(packet.claim_ceiling.si_time_force_binding === "DEFERRED", "SI binding must remain deferred");
  required(packet.claim_ceiling.upor === false && packet.claim_ceiling.dipole === false, "Upor/dipole firewall missing");
  required(packet.claim_ceiling.scale_binding === false && packet.claim_ceiling.validation === false, "scale/validation firewall missing");
  required(packet.claim_ceiling.canon_promotion === false, "canon firewall missing");

  return structuredClone(packet);
}
