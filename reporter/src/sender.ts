import { request } from "http";
import { request as httpsRequest } from "https";
import { URL } from "url";

export interface SendResult {
  success: boolean;
  status?: number;
  body?: string;
  error?: string;
}

export async function sendToHub(hubUrl: string, apiKey: string, path: string, data: unknown): Promise<SendResult> {
  return new Promise((resolve) => {
    try {
      const url = new URL(path, hubUrl);
      const payload = JSON.stringify(data);
      const isHttps = url.protocol === "https:";

      const req = (isHttps ? httpsRequest : request)(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "Authorization": `Bearer ${apiKey}`,
        },
      }, (res) => {
        let body = "";
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => {
          resolve({
            success: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            body,
          });
        });
      });

      req.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });

      req.setTimeout(10000, () => {
        req.destroy();
        resolve({ success: false, error: "Request timed out" });
      });

      req.write(payload);
      req.end();
    } catch (err) {
      resolve({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  });
}

export async function sendWithRetry(hubUrl: string, apiKey: string, path: string, data: unknown, maxAttempts: number): Promise<SendResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await sendToHub(hubUrl, apiKey, path, data);
    if (result.success) return result;

    // Don't retry on auth errors
    if (result.status === 401 || result.status === 403) return result;

    if (attempt < maxAttempts) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return { success: false, error: `Failed after ${maxAttempts} attempts` };
}
