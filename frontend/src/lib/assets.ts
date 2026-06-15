const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    let port = "4005";
    if (envUrl) {
      try {
        const urlObj = new URL(envUrl);
        if (urlObj.port) port = urlObj.port;
      } catch (e) {
        // ignore
      }
    }
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
};
const API_BASE_URL = getApiBaseUrl();

export const resolveAssetUrl = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${API_BASE_URL}${value}`;
  }

  return value;
};
