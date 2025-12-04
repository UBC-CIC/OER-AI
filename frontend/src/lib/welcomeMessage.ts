export async function getWelcomeMessage(): Promise<string> {
  const defaultMessage = `Welcome to Opterna - the open AI study companion created by BCcampus, UBC Cloud Innovation Centre, students, and faculty and generously funded by the William and Flora Hewlett Foundation.`;
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
