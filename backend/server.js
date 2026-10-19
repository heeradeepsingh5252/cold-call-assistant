import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env"
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Supabase URL loaded:", Boolean(supabaseUrl));
console.log(
  "Supabase key type:",
  supabaseKey.startsWith("sb_secret_")
    ? "New secret key"
    : supabaseKey.startsWith("sb_publishable_")
      ? "Publishable key - incorrect"
      : "Legacy or unrecognized key"
);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Cold Call Assistant backend is running",
  });
});

// Start a new call
app.post("/calls", async (req, res) => {
  try {
    const { prospect, company } = req.body ?? {};

    const { data, error } = await supabase
      .from("calls")
      .insert({
        prospect: prospect || "Unnamed prospect",
        company: company || "Company not entered",
        current_stage: 1,
      })
      .select()
      .single();

    if (error) {
      console.error("Create call error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error("Create call error:", error.message || error);
    return res.status(500).json({
      error: "Could not create call.",
    });
  }
});

// List saved calls
app.get("/calls", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("calls")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("List calls error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  } catch (error) {
    console.error("List calls error:", error.message || error);
    return res.status(500).json({
      error: "Could not load calls.",
    });
  }
});

// Save or update a stage result
app.post("/calls/:id/stages", async (req, res) => {
  try {
    const callId = Number(req.params.id);

    const {
      stage_number,
      stage_outcome,
      prospect_words,
      notes,
    } = req.body ?? {};

    if (
      !Number.isInteger(callId) ||
      callId <= 0 ||
      !Number.isInteger(stage_number) ||
      stage_number < 1 ||
      stage_number > 8
    ) {
      return res.status(400).json({
        error: "Invalid call ID or stage number.",
      });
    }

    const { data: existingCall, error: callError } = await supabase
      .from("calls")
      .select("id")
      .eq("id", callId)
      .maybeSingle();

    if (callError) {
      console.error("Check call error:", callError.message);
      return res.status(500).json({
        error: callError.message,
      });
    }

    if (!existingCall) {
      return res.status(404).json({
        error: "Call not found.",
      });
    }

    const { data, error } = await supabase
      .from("call_stage_results")
      .upsert(
        {
          call_id: callId,
          stage_number,
          stage_outcome: stage_outcome || null,
          prospect_words: prospect_words || null,
          notes: notes || null,
        },
        { onConflict: "call_id,stage_number" }
      )
      .select()
      .single();

    if (error) {
      console.error("Save stage error:", error.message);
      return res.status(500).json({
        error: error.message,
      });
    }

    const { error: updateError } = await supabase
      .from("calls")
      .update({ current_stage: stage_number })
      .eq("id", callId);

    if (updateError) {
      console.error("Update current stage error:", updateError.message);
      return res.status(500).json({
        error: updateError.message,
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("Save stage error:", error.message || error);
    return res.status(500).json({
      error: "Could not save stage result.",
    });
  }
});

// Close a call
app.post("/calls/:id/close", async (req, res) => {
  try {
    const callId = Number(req.params.id);
    const { outcome } = req.body ?? {};

    if (!Number.isInteger(callId) || callId <= 0 || !outcome) {
      return res.status(400).json({
        error: "A valid call ID and outcome are required.",
      });
    }

    const { data, error } = await supabase
      .from("calls")
      .update({
        outcome,
        closed_at: new Date().toISOString(),
      })
      .eq("id", callId)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Close call error:", error.message);
      return res.status(500).json({
        error: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Call not found.",
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("Close call error:", error.message || error);
    return res.status(500).json({
      error: "Could not close call.",
    });
  }
});

// List calls with their stage results
app.get("/calls/details", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("calls")
      .select("*, call_stage_results(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Call details error:", error.message);
      return res.status(500).json({
        error: error.message,
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("Call details error:", error.message || error);
    return res.status(500).json({
      error: "Could not load call details.",
    });
  }
});

// AI: Suggest a respectful response to a prospect's objection
app.post("/ai/objection-response", async (req, res) => {
  try {
    const { objection, prospect, company } = req.body ?? {};

    if (typeof objection !== "string" || !objection.trim()) {
      return res.status(400).json({
        error: "Please provide the prospect's objection.",
      });
    }

    if (!process.env.CEREBRAS_API_KEY) {
      return res.status(500).json({
        error:
          "CEREBRAS_API_KEY is missing from backend/.env or Render environment variables.",
      });
    }

    console.log("Requesting objection response from Cerebras...");

    const apiResponse = await fetch(
      "https://api.cerebras.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen-3.8-27b",
          messages: [
            {
              role: "system",
              content:
                "You help salespeople respond respectfully to cold-call objections. Write one natural response the caller can say aloud in under 40 words. Be polite, conversational, honest, and non-pushy. Respect requests not to be contacted. Do not invent product features, prices, or guarantees. Return only the suggested response.",
            },
            {
              role: "user",
              content: `Prospect: ${String(
                prospect || "Unknown"
              ).slice(0, 100)}
Company: ${String(company || "Unknown").slice(0, 100)}
Prospect's objection: ${objection.trim().slice(0, 1000)}

Suggest a suitable response the caller can say aloud.`,
            },
          ],
          temperature: 0.4,
          max_tokens: 100,
          reasoning_effort: "none",
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    const data = await apiResponse.json().catch(() => ({}));

    if (!apiResponse.ok) {
      const details =
        data?.error?.message ||
        data?.message ||
        data?.detail ||
        JSON.stringify(data) ||
        `Cerebras returned HTTP ${apiResponse.status}`;

      console.error(
        "Cerebras API error:",
        apiResponse.status,
        details
      );

      return res.status(502).json({
        error: "Cerebras could not generate a suggestion.",
        details,
      });
    }

    const content = data?.choices?.[0]?.message?.content;

    const suggestion =
      typeof content === "string"
        ? content.trim()
        : Array.isArray(content)
          ? content
              .map((part) =>
                typeof part === "string"
                  ? part
                  : part?.text || ""
              )
              .join("")
              .trim()
          : "";

    if (!suggestion) {
      console.error("Cerebras returned an empty response.");

      return res.status(502).json({
        error: "Cerebras returned an empty response. Please try again.",
      });
    }

    console.log("Cerebras suggestion generated successfully.");

    return res.json({ suggestion });
  } catch (error) {
    const isTimeout =
      error?.name === "TimeoutError" ||
      error?.name === "AbortError";

    console.error(
      "Cerebras request failed:",
      error.message || error
    );

    return res.status(502).json({
      error: isTimeout
        ? "Cerebras took too long to respond. Please try again."
        : "Could not generate a suggestion.",
      details: error.message || String(error),
    });
  }
});

// Start server after registering all routes
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});