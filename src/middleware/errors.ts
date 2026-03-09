import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error("[session-forge-hub] Error:", err.message);

  if (err.name === "SyntaxError" && "body" in err) {
    res.status(400).json({ error: "Invalid JSON in request body" });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
}
