import fs from 'node:fs';
import path from 'node:path';
import { G } from '../src/core/constants.js';

const BODIES = {
  Sun:     { id: '10',  gm: 132712440041.94 },
  Mercury: { id: '199', gm: 22031.868 },
  Venus:   { id: '299', gm: 324858.592 },
  Earth:   { id: '399', gm: 398600.435 },
  Moon:    { id: '301', gm: 4902.800 },
  Mars:    { id: '4',   gm: 42828.375 },
  Jupiter: { id: '5',   gm: 126712764.8 },
  Saturn:  { id: '6',   gm: 37940585.2 },
  Uranus:  { id: '7',   gm: 5794556.4 },
  Neptune: { id: '8',   gm: 6836527.1 },
};

function parseState(rawResult) {
  const start = rawResult.indexOf('$$SOE');
  const end = rawResult.indexOf('$$EOE');
  const block = rawResult.slice(start + 5, end).trim();
  const firstLine = block.split('\n')[0].trim();
  const parts = firstLine.split(',').map((s) => s.trim());
  // fields: JDTDB, calendar date, X, Y, Z, VX, VY, VZ
  const x = parseFloat(parts[2]);
  const y = parseFloat(parts[3]);
  const z = parseFloat(parts[4]);
  const vx = parseFloat(parts[5]);
  const vy = parseFloat(parts[6]);
  const vz = parseFloat(parts[7]);
  return {
    pos: [x * 1e3, y * 1e3, z * 1e3], // km -> m
    vel: [vx * 1e3, vy * 1e3, vz * 1e3], // km/s -> m/s
  };
}

const fixture = [];
for (const [name, meta] of Object.entries(BODIES)) {
  const cacheFile = path.resolve(`data/horizons/${meta.id}_2026-01-01.json`);
  if (!fs.existsSync(cacheFile)) {
    console.error(`Missing cache file for ${name} at ${cacheFile}`);
    continue;
  }
  const content = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  const state = parseState(content.result);
  const mass = (meta.gm * 1e9) / G; // GM (km^3/s^2) -> m^3/s^2 -> kg
  fixture.push({
    name,
    mass,
    pos: state.pos,
    vel: state.vel,
  });
}

const outDir = path.resolve('tests/fixtures');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
const outFile = path.join(outDir, 'solar_system_2026.json');
fs.writeFileSync(outFile, JSON.stringify(fixture, null, 2), 'utf-8');
console.log(`Saved ${fixture.length} bodies to ${outFile}`);
