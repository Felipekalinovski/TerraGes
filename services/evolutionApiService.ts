export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

export const createEvolutionInstance = async (config: EvolutionConfig) => {
  try {
    const response = await fetch(`${config.baseUrl}/instance/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': config.apiKey },
      body: JSON.stringify({ instanceName: config.instanceName, token: "", qrcode: true })
    });
    return await response.json();
  } catch (error) {
    console.error("Erro ao criar instância Evolution:", error);
    throw error;
  }
};

export const connectEvolutionInstance = async (config: EvolutionConfig) => {
  try {
    const response = await fetch(`${config.baseUrl}/instance/connect/${config.instanceName}`, {
      method: 'GET',
      headers: { 'apikey': config.apiKey }
    });
    const data = await response.json();
    return data.base64 || data.qrcode; 
  } catch (error) {
    console.error("Erro ao conectar instância:", error);
    throw error;
  }
};

export const setEvolutionWebhook = async (config: EvolutionConfig, webhookUrl: string) => {
  try {
    const response = await fetch(`${config.baseUrl}/webhook/set/${config.instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': config.apiKey },
      body: JSON.stringify({ webhookUrl: webhookUrl, webhookByEvents: true, events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE"] })
    });
    return await response.json();
  } catch (error) {
    console.error("Erro ao configurar webhook:", error);
    throw error;
  }
};

export const logoutEvolutionInstance = async (config: EvolutionConfig) => {
  try {
    await fetch(`${config.baseUrl}/instance/logout/${config.instanceName}`, {
      method: 'DELETE',
      headers: { 'apikey': config.apiKey }
    });
  } catch (error) {
    console.error("Erro ao desconectar:", error);
  }
};
