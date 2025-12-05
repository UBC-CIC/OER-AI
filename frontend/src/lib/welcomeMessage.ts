export async function getWelcomeMessage(): Promise<string> {
  const defaultMessage = `Welcome to Opterna - the  AI study companion.`;
  try {
    const resp = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/public/config/welcomeMessage`);
    if (!resp.ok) return defaultMessage;
    const json = await resp.json();
    if (!json || !json.welcomeMessage) return defaultMessage;
    return json.welcomeMessage;
  } catch (err) {
    console.error("Failed to fetch welcome message:", err);
    return defaultMessage;
  }
}
