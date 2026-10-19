
const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `Request failed (${response.status})`
    );
  }

  return data;
}

export function createCall(prospect, company) {
  return request("/calls", {
    method: "POST",
    body: JSON.stringify({ prospect, company }),
  });
}

export function getCalls() {
  return request("/calls/details");
}

export function saveStageResult(callId, stageNumber, result) {
  return request(`/calls/${callId}/stages`, {
    method: "POST",
    body: JSON.stringify({
      stage_number: stageNumber,
      stage_outcome: result.stageOutcome || "",
      prospect_words: result.prospectWords || "",
      notes: result.notes || "",
    }),
  });
}

export function closeCall(callId, outcome) {
  return request(`/calls/${callId}/close`, {
    method: "POST",
    body: JSON.stringify({ outcome }),
  });
}
// Generate an AI response to a prospect's objection
export function getObjectionSuggestion(objection, prospect, company) {
  const payload =
    objection && typeof objection === "object"
      ? objection
      : { objection, prospect, company };

  return request("/ai/objection-response", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}