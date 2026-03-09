import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { dirname } from "path";

export function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback;
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[session-forge-hub] Failed to read ${filePath}:`, err);
    return fallback;
  }
}

export function writeJson<T>(filePath: string, data: T): void {
  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[session-forge-hub] Failed to write ${filePath}:`, err);
  }
}

export function deleteJson(filePath: string): boolean {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}
