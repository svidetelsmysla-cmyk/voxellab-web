export const classifyRegimeShader = /* wgsl */ `
struct OutputPoint {
  response: vec4f,
  eigen: vec4f,
  metrics: vec4f,
}

@group(0) @binding(0) var<storage, read> volume: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> output: array<OutputPoint>;
@group(0) @binding(2) var<uniform> params: array<vec4f, 7>;

fn positive_mod(value: i32, modulus: i32) -> i32 {
  return ((value % modulus) + modulus) % modulus;
}

fn node(raw: vec3i) -> vec3f {
  let dims = vec3i(params[0].xyz);
  var p = raw;
  if (params[0].w > 0.5) {
    p = vec3i(positive_mod(p.x, dims.x), positive_mod(p.y, dims.y), positive_mod(p.z, dims.z));
  } else {
    p = clamp(p, vec3i(0), dims - vec3i(1));
  }
  let index = u32((p.z * dims.y + p.y) * dims.x + p.x);
  return volume[index].xyz;
}

fn sample_response(point: vec3f) -> vec3f {
  let g = (point - params[1].xyz) / params[2].xyz;
  let base = vec3i(floor(g));
  let f = fract(g);
  let c000 = node(base);
  let c100 = node(base + vec3i(1, 0, 0));
  let c010 = node(base + vec3i(0, 1, 0));
  let c110 = node(base + vec3i(1, 1, 0));
  let c001 = node(base + vec3i(0, 0, 1));
  let c101 = node(base + vec3i(1, 0, 1));
  let c011 = node(base + vec3i(0, 1, 1));
  let c111 = node(base + vec3i(1, 1, 1));
  return mix(mix(mix(c000, c100, f.x), mix(c010, c110, f.x), f.y),
             mix(mix(c001, c101, f.x), mix(c011, c111, f.x), f.y), f.z);
}

fn determinant(m: mat3x3f) -> f32 {
  return dot(m[0], cross(m[1], m[2]));
}

fn eigenvalues_symmetric(k: mat3x3f) -> vec3f {
  let p1 = k[1].x * k[1].x + k[2].x * k[2].x + k[2].y * k[2].y;
  if (p1 == 0.0) { return vec3f(k[0].x, k[1].y, k[2].z); }
  let q = (k[0].x + k[1].y + k[2].z) / 3.0;
  let p2 = (k[0].x-q)*(k[0].x-q) + (k[1].y-q)*(k[1].y-q) + (k[2].z-q)*(k[2].z-q) + 2.0*p1;
  let p = sqrt(p2 / 6.0);
  let centered = k - mat3x3f(vec3f(q,0,0), vec3f(0,q,0), vec3f(0,0,q));
  let b = mat3x3f(centered[0] / p, centered[1] / p, centered[2] / p);
  let r = clamp(determinant(b) / 2.0, -1.0, 1.0);
  let phi = acos(r) / 3.0;
  let emax = q + 2.0*p*cos(phi);
  let emin = q + 2.0*p*cos(phi + 2.0943951023931953);
  let emid = 3.0*q - emax - emin;
  return vec3f(min(emin, min(emid, emax)), emin + emid + emax - min(emin, min(emid, emax)) - max(emin, max(emid, emax)), max(emin, max(emid, emax)));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) invocation: vec3u) {
  let width = u32(params[2].w);
  let height = u32(params[3].w);
  if (invocation.x >= width || invocation.y >= height) { return; }
  let uv = vec2f(f32(invocation.x) / f32(max(width - 1u, 1u)), f32(invocation.y) / f32(max(height - 1u, 1u)));
  let point = params[3].xyz + (2.0*uv.x-1.0)*params[4].w*params[4].xyz + (2.0*uv.y-1.0)*params[5].w*params[5].xyz;
  let h = params[2].xyz;
  let cx = (sample_response(point + vec3f(h.x,0,0)) - sample_response(point - vec3f(h.x,0,0))) / (2.0*h.x);
  let cy = (sample_response(point + vec3f(0,h.y,0)) - sample_response(point - vec3f(0,h.y,0))) / (2.0*h.y);
  let cz = (sample_response(point + vec3f(0,0,h.z)) - sample_response(point - vec3f(0,0,h.z))) / (2.0*h.z);
  let j = mat3x3f(cx, cy, cz);
  let s = 0.5 * (j + transpose(j));
  let a = 0.5 * (j - transpose(j));
  let k = mat3x3f(-s[0], -s[1], -s[2]);
  let eig = eigenvalues_symmetric(k);
  let anti = length(a[0]) * length(a[0]) + length(a[1]) * length(a[1]) + length(a[2]) * length(a[2]);
  let sym = length(s[0]) * length(s[0]) + length(s[1]) * length(s[1]) + length(s[2]) * length(s[2]);
  let eta = sqrt(anti) / max(sqrt(sym), 1e-30);
  let stiffness_tolerance = params[6].x;
  let neutral_tolerance = params[6].y;
  let anti_tolerance = params[6].z;
  var class_id = 0u;
  if (eta <= anti_tolerance) {
    if (min(abs(eig.x), min(abs(eig.y), abs(eig.z))) <= neutral_tolerance) { class_id = 5u; }
    else {
      let positive = select(0u, 1u, eig.x > stiffness_tolerance) + select(0u, 1u, eig.y > stiffness_tolerance) + select(0u, 1u, eig.z > stiffness_tolerance);
      let negative = select(0u, 1u, eig.x < -stiffness_tolerance) + select(0u, 1u, eig.y < -stiffness_tolerance) + select(0u, 1u, eig.z < -stiffness_tolerance);
      if (positive == 3u) { class_id = 1u; }
      else if (positive == 2u && negative == 1u) { class_id = 2u; }
      else if (positive == 1u && negative == 2u) { class_id = 3u; }
      else if (negative == 3u) { class_id = 4u; }
      else { class_id = 5u; }
    }
  }
  let response = sample_response(point);
  let out_index = invocation.y * width + invocation.x;
  output[out_index].response = vec4f(response, length(response));
  output[out_index].eigen = vec4f(eig, min(abs(eig.x), min(abs(eig.y), abs(eig.z))));
  output[out_index].metrics = vec4f(eta, f32(class_id), uv);
}
`;
