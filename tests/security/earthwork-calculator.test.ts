import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEarthworkQuoteDescription,
  buildWhatsAppQuoteSummary,
  calculateEarthworkEstimate,
} from '../../supabase/functions/_shared/earthwork-calculator.ts';
import type { EarthworkCalculationInput } from '../../supabase/functions/_shared/earthwork-calculator.ts';

const example: EarthworkCalculationInput = {
  lengthM: 10,
  widthM: 5,
  depthM: 2,
  materialKey: 'argila',
  swellPercent: 25,
  truckCapacityM3: 12,
  truckFillPercent: 90,
  equipmentName: 'Escavadeira hidráulica',
  productivityM3PerHour: 30,
  operationalEfficiencyPercent: 75,
  minimumHours: 4,
  hourlyRate: 450,
  costPerTruckload: 100,
  materialCostPerLooseM3: 2,
  mobilizationCost: 300,
  contingencyPercent: 10,
  discount: 100,
};

test('earthwork estimate separates bank volume, loose volume, loads and hours', () => {
  const estimate = calculateEarthworkEstimate(example);
  assert.equal(estimate.result.bankVolumeM3, 100);
  assert.equal(estimate.result.looseVolumeM3, 125);
  assert.equal(estimate.result.effectiveTruckCapacityM3, 10.8);
  assert.equal(estimate.result.truckloads, 12);
  assert.equal(estimate.result.estimatedHours, 4.5);
});

test('earthwork estimate composes price without hiding assumptions', () => {
  const estimate = calculateEarthworkEstimate(example);
  assert.equal(estimate.result.machineCost, 2025);
  assert.equal(estimate.result.haulCost, 1200);
  assert.equal(estimate.result.materialCost, 250);
  assert.equal(estimate.result.subtotal, 3775);
  assert.equal(estimate.result.contingencyValue, 377.5);
  assert.equal(estimate.result.total, 4052.5);
  assert.equal(estimate.assumptions.length, 5);
});

test('earthwork estimate rejects missing physical and operational inputs', () => {
  assert.throws(() => calculateEarthworkEstimate({ ...example, depthM: 0 }), /invalid_depth/);
  assert.throws(() => calculateEarthworkEstimate({ ...example, truckFillPercent: 101 }), /invalid_truck_fill_percent/);
  assert.throws(() => calculateEarthworkEstimate({ ...example, productivityM3PerHour: 0 }), /invalid_productivity/);
});

test('quote and WhatsApp summaries carry the measured result and warning', () => {
  const estimate = calculateEarthworkEstimate(example);
  assert.match(buildEarthworkQuoteDescription(estimate), /100 m³ no corte/);
  const message = buildWhatsAppQuoteSummary(estimate);
  assert.match(message, /12 carga/);
  assert.match(message, /R\$\s*4\.052,50/);
  assert.match(message, /Estimativa preliminar/);
});
