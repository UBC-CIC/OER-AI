export function sanitizeForSpeech(text: string): string {
  if (!text) return "";
  let t = text;
  // Remove code blocks
  t = t.replace(/```[\s\S]*?```/g, "");
  // Remove inline code
  t = t.replace(/`([^`]+)`/g, "$1");
  // Turn markdown links [text](url) into text
  t = t.replace(/\[(.*?)\]\((.*?)\)/g, "$1");
  // Remove images
  t = t.replace(/!\[(.*?)\]\((.*?)\)/g, "");
  // Remove HTML tags
  t = t.replace(/<[^>]+>/g, "");
  // Collapse whitespace
  t = t.replace(/\s+/g, " ").trim();
  return t;
}
