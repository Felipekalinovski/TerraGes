export const EARTHWORK_CALCULATION_VERSION = 1 as const;

export const MATERIAL_PRESETS = [
  { key: 'terra_comum', label: 'Terra comum', swellPercent: 20 },
  { key: 'argila', label: 'Argila', swellPercent: 25 },
  { key: 'areia', label: 'Areia', swellPercent: 12 },
  { key: 'saibro', label: 'Saibro', swellPercent: 15 },
  { key: 'brita', label: 'Brita / cascalho', swellPercent: 10 },
  { key: 'rocha', label: 'Rocha fragmentada', swellPercent: 50 },
  { key: 'outro', label: 'Outro material', swellPercent: 20 },
] as const;

export type EarthworkMaterialKey = typeof MATERIAL_PRESETS[number]['key'];

export type EarthworkCalculationInput = {
  lengthM: number;
  widthM: number;
  depthM: number;
  materialKey: EarthworkMaterialKey;
  materialLabel?: string;
  swellPercent: number;
  truckCapacityM3: number;
  truckFillPercent: number;
  equipmentName: string;
  productivityM3PerHour: number;
  operationalEfficiencyPercent: number;
  minimumHours: number;
  hourlyRate: number;
  costPerTruckload: number;
  materialCostPerLooseM3: number;
  mobilizationCost: number;
  contingencyPercent: number;
  discount: number;
};

export type EarthworkEstimate = {
  version: typeof EARTHWORK_CALCULATION_VERSION;
  input: EarthworkCalculationInput;
  result: {
    bankVolumeM3: number;
    looseVolumeM3: number;
    effectiveTruckCapacityM3: number;
    truckloads: number;
    effectiveProductivityM3PerHour: number;
    productiveHours: number;
    estimatedHours: number;
    machineCost: number;
    haulCost: number;
    materialCost: number;
    mobilizationCost: number;
    contingencyValue: number;
    subtotal: number;
    discount: number;
    total: number;
  };
  assumptions: string[];
};

const finiteNonNegative = (value: number, field: string) => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`invalid_${field}`);
  return value;
};

const finitePositive = (value: number, field: string) => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`invalid_${field}`);
  return value;
};

const percent = (value: number, field: string) => {
  finiteNonNegative(value, field);
  if (value > 100) throw new Error(`invalid_${field}`);
  return value;
};

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const roundUpTo = (value: number, step: number) => round(Math.ceil(value / step) * step, 2);

export function getMaterialPreset(key: EarthworkMaterialKey) {
  return MATERIAL_PRESETS.find(item => item.key === key) ?? MATERIAL_PRESETS[0];
}

export function calculateEarthworkEstimate(raw: EarthworkCalculationInput): EarthworkEstimate {
  const input: EarthworkCalculationInput = {
    ...raw,
    lengthM: finitePositive(raw.lengthM, 'length'),
    widthM: finitePositive(raw.widthM, 'width'),
    depthM: finitePositive(raw.depthM, 'depth'),
    swellPercent: percent(raw.swellPercent, 'swell_percent'),
    truckCapacityM3: finitePositive(raw.truckCapacityM3, 'truck_capacity'),
    truckFillPercent: finitePositive(raw.truckFillPercent, 'truck_fill_percent'),
    productivityM3PerHour: finitePositive(raw.productivityM3PerHour, 'productivity'),
    operationalEfficiencyPercent: finitePositive(raw.operationalEfficiencyPercent, 'operational_efficiency'),
    minimumHours: finiteNonNegative(raw.minimumHours, 'minimum_hours'),
    hourlyRate: finiteNonNegative(raw.hourlyRate, 'hourly_rate'),
    costPerTruckload: finiteNonNegative(raw.costPerTruckload, 'cost_per_truckload'),
    materialCostPerLooseM3: finiteNonNegative(raw.materialCostPerLooseM3, 'material_cost'),
    mobilizationCost: finiteNonNegative(raw.mobilizationCost, 'mobilization_cost'),
    contingencyPercent: percent(raw.contingencyPercent, 'contingency_percent'),
    discount: finiteNonNegative(raw.discount, 'discount'),
  };

  if (input.truckFillPercent > 100) throw new Error('invalid_truck_fill_percent');
  if (input.operationalEfficiencyPercent > 100) throw new Error('invalid_operational_efficiency');

  const bankVolumeM3 = input.lengthM * input.widthM * input.depthM;
  const looseVolumeM3 = bankVolumeM3 * (1 + input.swellPercent / 100);
  const effectiveTruckCapacityM3 = input.truckCapacityM3 * (input.truckFillPercent / 100);
  const truckloads = Math.ceil(looseVolumeM3 / effectiveTruckCapacityM3);
  const effectiveProductivityM3PerHour = input.productivityM3PerHour * (input.operationalEfficiencyPercent / 100);
  const productiveHours = bankVolumeM3 / effectiveProductivityM3PerHour;
  const estimatedHours = Math.max(input.minimumHours, roundUpTo(productiveHours, 0.25));
  const machineCost = estimatedHours * input.hourlyRate;
  const haulCost = truckloads * input.costPerTruckload;
  const materialCost = looseVolumeM3 * input.materialCostPerLooseM3;
  const subtotal = machineCost + haulCost + materialCost + input.mobilizationCost;
  const contingencyValue = subtotal * (input.contingencyPercent / 100);
  const total = Math.max(0, subtotal + contingencyValue - input.discount);

  return {
    version: EARTHWORK_CALCULATION_VERSION,
    input,
    result: {
      bankVolumeM3: round(bankVolumeM3),
      looseVolumeM3: round(looseVolumeM3),
      effectiveTruckCapacityM3: round(effectiveTruckCapacityM3),
      truckloads,
      effectiveProductivityM3PerHour: round(effectiveProductivityM3PerHour),
      productiveHours: round(productiveHours),
      estimatedHours: round(estimatedHours),
      machineCost: round(machineCost),
      haulCost: round(haulCost),
      materialCost: round(materialCost),
      mobilizationCost: round(input.mobilizationCost),
      contingencyValue: round(contingencyValue),
      subtotal: round(subtotal),
      discount: round(input.discount),
      total: round(total),
    },
    assumptions: [
      'Volume no corte = comprimento × largura × profundidade média.',
      'Volume solto aplica o empolamento informado ao volume no corte.',
      'Cargas usam volume solto e a capacidade útil informada do caminhão.',
      'Horas usam volume no corte, produtividade informada e eficiência operacional.',
      'A estimativa deve ser confirmada com vistoria, acesso, distância de transporte, solo e modelo da máquina.',
    ],
  };
}

export function buildEarthworkQuoteDescription(estimate: EarthworkEstimate): string {
  const { input, result } = estimate;
  const material = input.materialLabel?.trim() || getMaterialPreset(input.materialKey).label;
  return [
    `Movimentação de ${material.toLowerCase()} em área de ${input.lengthM} m × ${input.widthM} m × ${input.depthM} m de profundidade média.`,
    `${result.bankVolumeM3} m³ no corte, ${result.looseVolumeM3} m³ soltos após ${input.swellPercent}% de empolamento.`,
    `Estimativa de ${result.truckloads} carga(s) e ${result.estimatedHours} hora(s) de ${input.equipmentName || 'equipamento'}.`,
  ].join(' ');
}

export function buildWhatsAppQuoteSummary(estimate: EarthworkEstimate): string {
  const { input, result } = estimate;
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  return [
    'Estimativa rápida TerraGes',
    `• Volume no corte: ${result.bankVolumeM3} m³`,
    `• Volume solto: ${result.looseVolumeM3} m³ (${input.swellPercent}% de empolamento)`,
    `• Transporte: ${result.truckloads} carga(s) de até ${result.effectiveTruckCapacityM3} m³ úteis`,
    `• Equipamento: ${input.equipmentName || 'não informado'} — ${result.estimatedHours} h estimadas`,
    `• Valor sugerido: ${currency.format(result.total)}`,
    'Estimativa preliminar. Confirme acesso, distância, descarte, umidade/solo, capacidade real e produtividade antes de enviar o orçamento.',
  ].join('\n');
}
