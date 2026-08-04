import type { Vec3 } from "../app/contracts";

export type AngularOperator =
  | "GOVERNED_V2B3C_PACKET_PLAYBACK"
  | "POINT_CUBATURE_CONTROL"
  | "P2_FIXED_FIBONACCI_CURVED_ANGULAR"
  | "P3A_ADAPTIVE_CURVED_ANGULAR"
  | "P3B_EXACT_CAP_SPHERE"
  | "P3B_GLOBAL_GAUSS_RAY_INTERVALS"
  | "P3C_EXPLICIT_SPHERICAL_POLYGON_BOOLEAN_FUTURE";

export interface AngularDiagnostic {
  operator: AngularOperator;
  cap_area: number;
  direction_count: number;
  directions: Vec3[];
  h_omega: number[];
  hit_mask: boolean[];
  vector_integral: Vec3;
  quadrature_family: string;
  geometry_route: string;
  authority: "BROWSER_PREVIEW" | "GOVERNED_GOLDEN_PLAYBACK" | "FUTURE_NOT_IMPLEMENTED";
  golden_parity: "NOT_ISSUED" | "GOVERNED_SOURCE_RESULT";
}

export const V2B3C_GOLDEN = {
  producer_commit: "2c7a376cb9276db7bf8eecfc34a1fc0575874f06",
  verdict: "CURVED_SOLID_ANGLE_ANALYTIC_ORACLE_BLOCKER",
  authority_hierarchy: ["ANALYTIC_ORACLE", "FUTURE_INDEPENDENT_HIGH_ORDER_VOLUME_INTEGRAL", "P3B", "P3A", "P1_LOW_ORDER_POINT_CUBATURE"],
  p1_v3_maximum_sphere_error: 0.04107518030063147,
  p1_two_finest_maximum_error: 0.11234173079782749,
  p2_worst_case_relative_outlier: 0.9982902848633791,
  p2_outlier_localization: { scene: null, control: null, component: null, absolute_error: null, reference_magnitude: null, relative_denominator: null, near_zero_flag: null, status: "CAUSE_NOT_YET_LOCALIZED" },
  p3a_p3b_two_finest_relative_delta_max: 0.010485913657058017,
  p3b_two_finest_relative_error_max: 1.708497894455263e-7,
  p3_surface_continuity_residual: 4.074739600104183e-6,
  mesh_p3a_p3b_relative_delta: 0.0005445994985393824,
  independence_scope: "ANGULAR_QUADRATURE_ONLY_SHARED_RAY_INTERVAL_GEOMETRY",
  claim_ceiling: "RUNTIME_DIAGNOSTIC_NOT_VALIDATION",
} as const;

export function analyticSphereCapArea(distance: number, radius: number): number {
  if (distance < 0 || radius <= 0) throw new Error("distance must be nonnegative and radius positive");
  if (distance <= radius) return 4 * Math.PI;
  return 2 * Math.PI * (1 - Math.sqrt(distance * distance - radius * radius) / distance);
}

function fibonacciDirections(count: number): Vec3[] {
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - 2 * (i + .5) / count; const r = Math.sqrt(1 - y * y); const a = i * Math.PI * (3 - Math.sqrt(5));
    return [r * Math.cos(a), y, r * Math.sin(a)];
  });
}

function rayLengths(receiver: Vec3, centre: Vec3, radius: number, directions: Vec3[]): number[] {
  const oc: Vec3 = [receiver[0] - centre[0], receiver[1] - centre[1], receiver[2] - centre[2]];
  return directions.map((u) => {
    const projection = oc[0] * u[0] + oc[1] * u[1] + oc[2] * u[2];
    const discriminant = projection ** 2 - (oc[0] ** 2 + oc[1] ** 2 + oc[2] ** 2 - radius ** 2);
    if (discriminant <= 0) return 0;
    const root = Math.sqrt(discriminant), entry = -projection - root, exit = -projection + root;
    return Math.max(exit - Math.max(entry, 0), 0);
  });
}

export function fixedFibonacciCurvedAngular(receiver: Vec3, centre: Vec3, radius: number, density: number, count = 3072): AngularDiagnostic {
  const directions = fibonacciDirections(count), lengths = rayLengths(receiver, centre, radius, directions), weight = 4 * Math.PI / count, vector: Vec3 = [0,0,0];
  directions.forEach((u, i) => { const h = density * lengths[i]!; vector[0] -= u[0] * h * weight; vector[1] -= u[1] * h * weight; vector[2] -= u[2] * h * weight; });
  return { operator: "P2_FIXED_FIBONACCI_CURVED_ANGULAR", cap_area: analyticSphereCapArea(Math.hypot(receiver[0]-centre[0],receiver[1]-centre[1],receiver[2]-centre[2]), radius), direction_count: count, directions, h_omega: lengths.map((v)=>density*v), hit_mask: lengths.map((v)=>v>0), vector_integral: vector, quadrature_family: "FIXED_ANTIPODAL_FIBONACCI_EQUAL_WEIGHT_BIN_CENTRES", geometry_route: "EXACT_ANALYTIC_SPHERE_RAY_INTERVAL_PER_DIRECTION", authority: "BROWSER_PREVIEW", golden_parity: "NOT_ISSUED" };
}

function gaussLegendre(order: number): { nodes: number[]; weights: number[] } {
  const nodes = Array<number>(order), weights = Array<number>(order), half = Math.ceil(order / 2);
  for (let i = 0; i < half; i += 1) {
    let z = Math.cos(Math.PI * (i + .75) / (order + .5)), previous = 0, derivative = 0;
    do {
      previous = z; let p1 = 1, p2 = 0;
      for (let j = 1; j <= order; j += 1) { const p3 = p2; p2 = p1; p1 = ((2*j-1)*z*p2-(j-1)*p3)/j; }
      derivative = order * (z * p1 - p2) / (z*z - 1); z = previous - p1 / derivative;
    } while (Math.abs(z - previous) > 1e-15);
    nodes[i] = -z; nodes[order - 1 - i] = z; const weight = 2 / ((1-z*z)*derivative*derivative); weights[i] = weight; weights[order - 1 - i] = weight;
  }
  return { nodes, weights };
}

export function exactCapPolarGaussSphere(receiver: Vec3, centre: Vec3, radius: number, density: number, order = 96): AngularDiagnostic {
  const radial: Vec3 = [receiver[0]-centre[0],receiver[1]-centre[1],receiver[2]-centre[2]], distance = Math.hypot(...radial), axis: Vec3 = distance ? radial.map((v)=>v/distance) as Vec3 : [1,0,0];
  const muMin = -1, muMax = distance <= radius ? 1 : -Math.sqrt(1-(radius/distance)**2), { nodes, weights } = gaussLegendre(order);
  let sum = 0; const h: number[] = [];
  nodes.forEach((node,i)=>{const mu=.5*((muMax-muMin)*node+muMax+muMin), weight=.5*(muMax-muMin)*weights[i]!, root=Math.sqrt(Math.max(radius**2-distance**2+distance**2*mu**2,0)), entry=-distance*mu-root, exit=-distance*mu+root, length=Math.max(exit-Math.max(entry,0),0);h.push(density*length);sum+=weight*mu*length;});
  const scalar=-2*Math.PI*density*sum, displayDirections=fibonacciDirections(3072), displayLengths=rayLengths(receiver,centre,radius,displayDirections);
  return { operator:"P3B_EXACT_CAP_SPHERE",cap_area:analyticSphereCapArea(distance,radius),direction_count:order,directions:displayDirections,h_omega:displayLengths.map(v=>density*v),hit_mask:displayLengths.map(v=>v>0),vector_integral:axis.map(v=>scalar*v) as Vec3,quadrature_family:"EXACT_SPHERICAL_CAP_BOUNDARY_PLUS_POLAR_GAUSS",geometry_route:"ANALYTIC_SPHERE_EXACT_RAY_INTERVAL",authority:"BROWSER_PREVIEW",golden_parity:"NOT_ISSUED" };
}

export function governedPlayback(operator: AngularOperator): AngularDiagnostic {
  const future = operator === "P3C_EXPLICIT_SPHERICAL_POLYGON_BOOLEAN_FUTURE";
  return { operator, cap_area:0,direction_count:0,directions:[],h_omega:[],hit_mask:[],vector_integral:[0,0,0],quadrature_family: operator === "P3A_ADAPTIVE_CURVED_ANGULAR" ? "ADAPTIVE_SPHERICAL_TESSELLATION" : operator === "P3B_GLOBAL_GAUSS_RAY_INTERVALS" ? "GLOBAL_GAUSS_LEGENDRE_X_AZIMUTHAL" : "GOVERNED_PACKET_CURVES_AND_METADATA",geometry_route:operator === "P3B_GLOBAL_GAUSS_RAY_INTERVALS" ? "SHARED_EXACT_RAY_INTERVALS_NOT_POLYGON_BOOLEAN" : future ? "NOT_IMPLEMENTED" : "GOVERNED_SOURCE_PACKET",authority:future?"FUTURE_NOT_IMPLEMENTED":"GOVERNED_GOLDEN_PLAYBACK",golden_parity:future?"NOT_ISSUED":"GOVERNED_SOURCE_RESULT" };
}
