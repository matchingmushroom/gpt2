export function toDirectDriveUrl(url: string): string {
  if (!url) return url;
  if (url.includes("lh3.googleusercontent.com")) return url;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  return url;
}
