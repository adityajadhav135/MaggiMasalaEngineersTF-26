/**
 * High-performance 64-bit 3D vector operations using Float64Array.
 * Never uses Float32Array to preserve sub-millimeter precision at astronomical scales (1 AU ~ 1.5e11 m).
 */

export function create(x = 0.0, y = 0.0, z = 0.0) {
  const out = new Float64Array(3);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function fromValues(x, y, z) {
  return create(x, y, z);
}

export function fromArray(arr) {
  return create(arr[0] || 0.0, arr[1] || 0.0, arr[2] || 0.0);
}

export function clone(a) {
  return create(a[0], a[1], a[2]);
}

export function copy(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}

export function set(out, x, y, z) {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function zero(out) {
  out[0] = 0.0;
  out[1] = 0.0;
  out[2] = 0.0;
  return out;
}

export function add(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}

export function sub(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}

export function scale(out, a, s) {
  out[0] = a[0] * s;
  out[1] = a[1] * s;
  out[2] = a[2] * s;
  return out;
}

export function scaleAndAdd(out, a, b, s) {
  out[0] = a[0] + b[0] * s;
  out[1] = a[1] + b[1] * s;
  out[2] = a[2] + b[2] * s;
  return out;
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(out, a, b) {
  const ax = a[0], ay = a[1], az = a[2];
  const bx = b[0], by = b[1], bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}

export function normSq(a) {
  return a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
}

export function norm(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

export function dist(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dy, dz);
}

export function normalize(out, a) {
  const len = Math.hypot(a[0], a[1], a[2]);
  if (len > 0.0) {
    const inv = 1.0 / len;
    out[0] = a[0] * inv;
    out[1] = a[1] * inv;
    out[2] = a[2] * inv;
  } else {
    out[0] = 0.0;
    out[1] = 0.0;
    out[2] = 0.0;
  }
  return out;
}
