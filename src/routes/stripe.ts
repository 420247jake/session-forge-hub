import { Router, Request, Response } from "express";
import { config } from "../config.js";

export const stripeRoutes = Router();

// GET /api/donate/config — check if Stripe is configured
stripeRoutes.get("/config", (_req: Request, res: Response) => {
  res.json({
    configured: !!config.stripe.secretKey,
    publishableKey: config.stripe.publishableKey || null,
  });
});

// POST /api/donate/create-session — create Stripe Checkout session
stripeRoutes.post("/create-session", async (req: Request, res: Response) => {
  if (!config.stripe.secretKey) {
    res.status(503).json({
      error: "Stripe not configured",
      fallback: "https://github.com/sponsors/420247jake",
    });
    return;
  }

  try {
    // Dynamic import — Stripe is an optional dependency
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(config.stripe.secretKey);

    const amount = parseInt(req.body.amount) || 500; // Default $5.00

    if (amount < 100 || amount > 100000) {
      res.status(400).json({ error: "Amount must be between $1.00 and $1,000.00" });
      return;
    }

    const origin = req.headers.origin || `http://localhost:${config.port}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "session-forge hub — Donation",
            description: "Thank you for supporting open-source, local-first developer tools!",
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      success_url: `${origin}/donate.html?success=true`,
      cancel_url: `${origin}/donate.html?cancelled=true`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("[session-forge-hub] Stripe error:", err);
    res.status(500).json({ error: "Failed to create payment session" });
  }
});
