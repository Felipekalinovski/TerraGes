import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateServiceOrderCompletion, serviceOrderErrorMessage } from '../../services/serviceOrderRules.ts';

const valid = { client: 'Obra A', machine_id: 'machine-a', start_hour: 100, end_hour: 108, hourly_rate: 200 };

test('completion accepts form strings and a maximum one-day shift', () => {
    assert.equal(validateServiceOrderCompletion(valid), null);
    assert.equal(validateServiceOrderCompletion({ ...valid, start_hour: '100', end_hour: '124', hourly_rate: '200' }), null);
});

test('completion rejects empty, non-finite, regressing and excessive values', () => {
    for (const change of [
        { client: ' ' }, { machine_id: '' }, { start_hour: '' }, { hourly_rate: ' ' },
        { hourly_rate: NaN }, { end_hour: Infinity }, { start_hour: -1 },
        { end_hour: 100 }, { end_hour: 125 }, { hourly_rate: -10 }, { hourly_rate: 1000001 },
    ]) assert.ok(validateServiceOrderCompletion({ ...valid, ...change }), JSON.stringify(change));
});

test('concurrent completion and protected transaction errors have actionable messages', () => {
    assert.match(serviceOrderErrorMessage({ message: 'completed_order_requires_adjustment' }), /já foi concluída/);
    assert.match(serviceOrderErrorMessage({ message: 'settlement_requires_adjustment' }), /apenas a situação do recebimento/);
    assert.match(serviceOrderErrorMessage({ message: 'manager_required' }), /Somente um gestor/);
    assert.doesNotMatch(serviceOrderErrorMessage({ message: 'secret database details' }), /secret/);
});
