import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Calculator,
  ChevronDown,
  Clock3,
  Coins,
  Gauge,
  Layers3,
  Ruler,
  Shovel,
  Truck,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { machineService, Machine } from '../services/machineService';
import {
  calculateEarthworkEstimate,
  EarthworkCalculationInput,
  EarthworkMaterialKey,
  MATERIAL_PRESETS,
} from '../supabase/functions/_shared/earthwork-calculator';

export const EARTHWORK_QUOTE_DRAFT_KEY = 'terrages:earthwork-quote-draft';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

const inputClass = 'w-full min-h-12 rounded-xl border border-white/10 bg-black/35 px-3.5 py-3 text-base font-bold text-white outline-none transition-colors placeholder:text-gray-600 focus:border-primary/60';
const selectClass = `${inputClass} appearance-none pr-10`;

const Section: React.FC<{ icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }> = ({ icon, title, hint, children }) => (
  <section className="rounded-3xl border border-white/7 bg-surface-dark/55 p-4 sm:p-5">
    <div className="mb-4 flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">{icon}</div>
      <div>
        <h2 className="text-base font-black text-white">{title}</h2>
        {hint && <p className="mt-0.5 text-sm leading-5 text-gray-500">{hint}</p>}
      </div>
    </div>
    {children}
  </section>
);

const NumberField: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
}> = ({ label, value, onChange, suffix, min = 0, max, step = 0.1 }) => (
  <label className="block space-y-1.5">
    <span className="text-sm font-bold text-gray-300">{label}</span>
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ''}
        onChange={event => onChange(Number(event.target.value))}
        min={min}
        max={max}
        step={step}
        className={`${inputClass} ${suffix ? 'pr-12' : ''}`}
      />
      {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-gray-500">{suffix}</span>}
    </div>
  </label>
);

export const OrcamentoCalculator: React.FC = () => {
  const navigate = useNavigate();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [input, setInput] = useState<EarthworkCalculationInput>({
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
    costPerTruckload: 0,
    materialCostPerLooseM3: 0,
    mobilizationCost: 0,
    contingencyPercent: 10,
    discount: 0,
  });

  useEffect(() => {
    machineService.getAll()
      .then(data => setMachines(data.filter(machine => machine.status === 'active')))
      .catch(() => setMachines([]));
  }, []);

  const setNumber = (key: keyof EarthworkCalculationInput) => (value: number) => {
    setInput(current => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }));
  };

  const estimate = useMemo(() => {
    try {
      return calculateEarthworkEstimate(input);
    } catch {
      return null;
    }
  }, [input]);

  const chooseMaterial = (materialKey: EarthworkMaterialKey) => {
    const material = MATERIAL_PRESETS.find(item => item.key === materialKey) ?? MATERIAL_PRESETS[0];
    setInput(current => ({
      ...current,
      materialKey,
      materialLabel: undefined,
      swellPercent: material.swellPercent,
    }));
  };

  const createQuote = () => {
    if (!estimate) return;
    sessionStorage.setItem(EARTHWORK_QUOTE_DRAFT_KEY, JSON.stringify(estimate));
    navigate('/orcamentos/novo');
  };

  return (
    <Layout>
      <Layout.Header title="Calculadora" subTitle="Volumetria e preço rápido" showBack />
      <Layout.Content>
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-44 pt-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)] lg:items-start lg:pb-12">
          <div className="space-y-4">
            <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-black shadow-lg shadow-primary/15">
                  <Calculator size={22} strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-lg font-black text-white">Orçamento de terraplenagem</h1>
                  <p className="text-sm text-gray-400">Preencha as condições reais da obra. O resultado atualiza na hora.</p>
                </div>
              </div>
            </div>

            <Section icon={<Ruler size={20} />} title="1. Medidas do serviço" hint="Use a profundidade média quando o terreno for irregular.">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <NumberField label="Comprimento" value={input.lengthM} onChange={setNumber('lengthM')} suffix="m" />
                <NumberField label="Largura" value={input.widthM} onChange={setNumber('widthM')} suffix="m" />
                <div className="col-span-2 sm:col-span-1">
                  <NumberField label="Profundidade média" value={input.depthM} onChange={setNumber('depthM')} suffix="m" />
                </div>
              </div>
            </Section>

            <Section icon={<Layers3 size={20} />} title="2. Material e transporte" hint="O empolamento transforma o volume no corte em volume solto para estimar as cargas.">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold text-gray-300">Material</span>
                  <div className="relative">
                    <select value={input.materialKey} onChange={event => chooseMaterial(event.target.value as EarthworkMaterialKey)} className={selectClass}>
                      {MATERIAL_PRESETS.map(material => <option key={material.key} value={material.key}>{material.label}</option>)}
                    </select>
                    <ChevronDown size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  </div>
                </label>
                <NumberField label="Empolamento" value={input.swellPercent} onChange={setNumber('swellPercent')} suffix="%" max={100} step={1} />
                <NumberField label="Caçamba do caminhão" value={input.truckCapacityM3} onChange={setNumber('truckCapacityM3')} suffix="m³" />
                <NumberField label="Aproveitamento da caçamba" value={input.truckFillPercent} onChange={setNumber('truckFillPercent')} suffix="%" max={100} step={1} />
              </div>
            </Section>

            <Section icon={<Shovel size={20} />} title="3. Máquina e tempo" hint="Produtividade e eficiência são estimativas editáveis; confirme conforme modelo, operador, acesso e solo.">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-bold text-gray-300">Equipamento</span>
                  <div className="relative">
                    <select
                      value={machines.some(machine => machine.name === input.equipmentName) ? input.equipmentName : '__manual__'}
                      onChange={event => event.target.value !== '__manual__' && setInput(current => ({ ...current, equipmentName: event.target.value }))}
                      className={selectClass}
                    >
                      {machines.map(machine => <option key={machine.id} value={machine.name}>{machine.name}</option>)}
                      <option value="__manual__">Informar equipamento</option>
                    </select>
                    <ChevronDown size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  </div>
                </label>
                {!machines.some(machine => machine.name === input.equipmentName) && (
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-sm font-bold text-gray-300">Nome do equipamento</span>
                    <input value={input.equipmentName} onChange={event => setInput(current => ({ ...current, equipmentName: event.target.value }))} className={inputClass} />
                  </label>
                )}
                <NumberField label="Produtividade estimada" value={input.productivityM3PerHour} onChange={setNumber('productivityM3PerHour')} suffix="m³/h" />
                <NumberField label="Eficiência operacional" value={input.operationalEfficiencyPercent} onChange={setNumber('operationalEfficiencyPercent')} suffix="%" max={100} step={1} />
                <NumberField label="Cobrança mínima" value={input.minimumHours} onChange={setNumber('minimumHours')} suffix="h" step={0.5} />
                <NumberField label="Valor da hora" value={input.hourlyRate} onChange={setNumber('hourlyRate')} suffix="R$" step={10} />
              </div>
            </Section>

            <Section icon={<Coins size={20} />} title="4. Custos complementares" hint="Deixe em zero o que não fizer parte deste serviço.">
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField label="Preço por carga" value={input.costPerTruckload} onChange={setNumber('costPerTruckload')} suffix="R$" step={10} />
                <NumberField label="Material por m³ solto" value={input.materialCostPerLooseM3} onChange={setNumber('materialCostPerLooseM3')} suffix="R$" step={1} />
                <NumberField label="Mobilização e outros" value={input.mobilizationCost} onChange={setNumber('mobilizationCost')} suffix="R$" step={10} />
                <NumberField label="Margem de segurança" value={input.contingencyPercent} onChange={setNumber('contingencyPercent')} suffix="%" max={100} step={1} />
                <NumberField label="Desconto" value={input.discount} onChange={setNumber('discount')} suffix="R$" step={10} />
              </div>
            </Section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <section className="overflow-hidden rounded-3xl border border-primary/20 bg-surface-dark/80 shadow-2xl shadow-black/20">
              <div className="border-b border-white/7 bg-primary/8 px-5 py-4">
                <p className="text-sm font-black uppercase tracking-wider text-primary">Estimativa rápida</p>
              </div>
              {estimate ? (
                <div className="space-y-5 p-5">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: <Layers3 size={17} />, label: 'No corte', value: `${decimal.format(estimate.result.bankVolumeM3)} m³` },
                      { icon: <Gauge size={17} />, label: 'Volume solto', value: `${decimal.format(estimate.result.looseVolumeM3)} m³` },
                      { icon: <Truck size={17} />, label: 'Cargas', value: String(estimate.result.truckloads) },
                      { icon: <Clock3 size={17} />, label: 'Horas', value: `${decimal.format(estimate.result.estimatedHours)} h` },
                    ].map(item => (
                      <div key={item.label} className="rounded-2xl border border-white/6 bg-black/25 p-3.5">
                        <div className="mb-2 flex items-center gap-2 text-gray-500">{item.icon}<span className="text-xs font-bold">{item.label}</span></div>
                        <p className="text-xl font-black text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t border-white/7 pt-4 text-sm">
                    <div className="flex justify-between gap-4 text-gray-400"><span>Máquina</span><strong className="text-white">{currency.format(estimate.result.machineCost)}</strong></div>
                    <div className="flex justify-between gap-4 text-gray-400"><span>Transporte</span><strong className="text-white">{currency.format(estimate.result.haulCost)}</strong></div>
                    <div className="flex justify-between gap-4 text-gray-400"><span>Material</span><strong className="text-white">{currency.format(estimate.result.materialCost)}</strong></div>
                    <div className="flex justify-between gap-4 text-gray-400"><span>Mobilização</span><strong className="text-white">{currency.format(estimate.result.mobilizationCost)}</strong></div>
                    <div className="flex justify-between gap-4 text-gray-400"><span>Margem ({input.contingencyPercent}%)</span><strong className="text-white">{currency.format(estimate.result.contingencyValue)}</strong></div>
                    {estimate.result.discount > 0 && <div className="flex justify-between gap-4 text-gray-400"><span>Desconto</span><strong className="text-negative">− {currency.format(estimate.result.discount)}</strong></div>}
                  </div>

                  <div className="rounded-2xl bg-primary p-4 text-black">
                    <p className="text-xs font-black uppercase tracking-wider opacity-70">Preço sugerido</p>
                    <p className="mt-1 text-3xl font-black">{currency.format(estimate.result.total)}</p>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3.5 text-gray-400">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
                    <p className="text-sm leading-5">Estimativa preliminar. Confirme acesso, distância, descarte, condição do material e produtividade da máquina antes de enviar.</p>
                  </div>

                  <button onClick={createQuote} className="hidden min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-black uppercase tracking-wider text-black transition-transform active:scale-[0.98] lg:flex">
                    Criar orçamento com estes valores
                  </button>
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-gray-500">Preencha medidas, capacidade e produtividade maiores que zero.</div>
              )}
            </section>
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-[73px] z-40 border-t border-white/8 bg-brand-dark/95 px-4 py-3 backdrop-blur-xl md:bottom-0 lg:hidden">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-500">Preço sugerido</p>
              <p className="truncate text-xl font-black text-white">{estimate ? currency.format(estimate.result.total) : 'Revise os dados'}</p>
            </div>
            <button disabled={!estimate} onClick={createQuote} className="min-h-12 rounded-2xl bg-primary px-4 text-sm font-black text-black disabled:opacity-40">
              Criar orçamento
            </button>
          </div>
        </div>
      </Layout.Content>
    </Layout>
  );
};
