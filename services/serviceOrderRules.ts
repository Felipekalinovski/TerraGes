type CompletionInput = {
    client: string;
    machine_id: string;
    start_hour: number | string;
    end_hour: number | string;
    hourly_rate: number | string;
};

export function validateServiceOrderCompletion(order: CompletionInput): string | null {
    const start = Number(order.start_hour);
    const end = Number(order.end_hour);
    const rate = Number(order.hourly_rate);
    if (!order.client.trim() || !order.machine_id) return 'Informe o cliente e a máquina antes de concluir.';
    if ([order.start_hour, order.end_hour, order.hourly_rate].some(value => String(value).trim() === '') ||
        ![start, end, rate].every(Number.isFinite) || start < 0 || start > 1000000 || rate < 0 || rate > 1000000) {
        return 'Confira os horímetros e o valor por hora: os valores devem ser válidos e não negativos.';
    }
    if (end <= start || end - start > 24) return 'O horímetro final deve superar o inicial em até 24 horas por OS.';
    return null;
}

export function serviceOrderErrorMessage(error: unknown): string {
    const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    if (message.includes('completed_order_requires_adjustment')) return 'Esta OS já foi concluída. Os dados de faturamento não podem ser alterados ou reabertos.';
    if (message.includes('settlement_requires_adjustment') || message.includes('service_order_settlements_transaction_id_fkey')) return 'Esta receita está vinculada a uma OS concluída. É possível alterar apenas a situação do recebimento.';
    if (message.includes('manager_required')) return 'Somente um gestor pode concluir a OS e gerar a receita.';
    if (message.includes('invalid_service_order')) return 'Confira cliente, máquina, horímetros e valor por hora antes de concluir a OS.';
    return 'Não foi possível salvar. Confira sua conexão e suas permissões e tente novamente.';
}
