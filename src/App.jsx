
import { useEffect, useMemo, useState } from "react";
import {
  createCall,
  getCalls,
  saveStageResult,
  closeCall,
  getObjectionSuggestion,
} from "./api";
import "./App.css";

const stages = [
  {
    name: "Opening",
    purpose: "Reach the right person and say who you are.",
    examples: [
      "What is this call about?",
      "I'm in a meeting right now.",
      "That person no longer works here.",
    ],
  },
  {
    name: "Purpose",
    purpose: "Explain clearly why you called in one or two sentences.",
    examples: [
      "What does your company do?",
      "Where did you get my number?",
      "Is this a sales call?",
    ],
  },
  {
    name: "Permission",
    purpose: "Find out whether they are willing to talk now.",
    examples: [
      "Call me after two.",
      "Yes, go ahead.",
      "Send it on WhatsApp first.",
    ],
  },
  {
    name: "Their business",
    purpose: "Ask about their company and work before pitching.",
    examples: [
      "We are a small manufacturing company.",
      "That's not what our division does.",
      "Tell me about your company first.",
    ],
  },
  {
    name: "Their need",
    purpose: "Capture what the prospect wants or struggles with in their own words.",
    examples: [
      "We want to enter a new market.",
      "Everything is fine right now.",
      "What can you do for a company like ours?",
    ],
  },
  {
    name: "Objection",
    purpose: "Understand the reason behind a no.",
    examples: [
      "We already have an agency.",
      "You need to speak to our owner.",
      "Send me something in writing.",
    ],
  },
  {
    name: "Next step",
    purpose: "Agree on one concrete action, time, or communication channel.",
    examples: [
      "Send me the report by email.",
      "Call me tomorrow at 11.",
      "Speak to my colleague instead.",
    ],
  },
  {
    name: "Close",
    purpose: "Record the actual outcome, next step, and prospect's words.",
    examples: [
      "Thanks, goodbye.",
      "I'm not interested.",
      "The call has disconnected.",
    ],
  },
];

const outcomesByStage = {
  0: [
    "Reached the right person",
    "Assistant or switchboard",
    "Person left company",
    "Wrong person",
  ],
  1: [
    "Asked what we do",
    "Asked where we got the number",
    "Asked if this is a sales call",
    "Purpose understood",
  ],
  2: [
    "Agreed to talk",
    "Busy, call back",
    "Asked for WhatsApp",
    "Declined to talk",
  ],
  3: [
    "Explained their business",
    "Gave a brief answer",
    "Corrected our understanding",
    "Asked about our company",
  ],
  4: [
    "Shared a goal",
    "Shared a problem",
    "Said no need",
    "Asked what we can do",
  ],
  5: [
    "Already has an agency",
    "Has an in-house team",
    "Wrong contact",
    "Requested information",
  ],
  6: [
    "Meeting agreed",
    "Callback scheduled",
    "Email requested",
    "No next step agreed",
  ],
  7: [
    "Call completed",
    "Not interested",
    "Call disconnected",
    "Do not call",
  ],
};

const phraseCategories = [
  {
    name: "Needs",
    pattern:
      /\b(need|needs|want|wants|looking for|more leads|more customers|increase sales|grow|growth|goal)\b/i,
  },
  {
    name: "Problems",
    pattern:
      /\b(problem|problems|issue|issues|struggle|difficult|challenge|slow sales|not getting leads|low conversion)\b/i,
  },
  {
    name: "Objections",
    pattern:
      /\b(not interested|no need|already have|too expensive|not now|send me information|send details|call later|no budget)\b/i,
  },
];

const objectionPatterns = [
  {
    name: "Not interested",
    pattern: /\b(not interested|no interest|isn't interested)\b/i,
  },
  {
    name: "No need",
    pattern: /\b(no need|don't need|do not need|not needed)\b/i,
  },
  {
    name: "Too expensive",
    pattern: /\b(too expensive|costs too much|too costly|price is high)\b/i,
  },
  {
    name: "No budget",
    pattern: /\b(no budget|budget is tight|can't afford|cannot afford)\b/i,
  },
  {
    name: "Already have a solution",
    pattern: /\b(already have|already using|using another|have a provider)\b/i,
  },
  {
    name: "Call later",
    pattern: /\b(call later|call me later|not now|busy right now)\b/i,
  },
  {
    name: "Send information",
    pattern: /\b(send me information|send details|send an email|email me)\b/i,
  },
];

const objectionResponses = {
  "Not interested":
    "I understand. May I ask what you're currently doing to handle this?",
  "No need":
    "Understood. Is this something you already handle internally?",
  "Too expensive":
    "I understand budget matters. What results would make this investment worthwhile for you?",
  "No budget":
    "That makes sense. Would it be useful to revisit this when budget becomes available?",
  "Already have a solution":
    "That's good to hear. Is there anything you'd like to improve about your current solution?",
  "Call later":
    "Certainly. What day and time would be convenient for you?",
  "Send information":
    "Of course. Which specific details would be most useful for you?",
};

function formatCallFromDatabase(call) {
  const results = call.call_stage_results || [];

  const sortedResults = [...results].sort(
    (a, b) => a.stage_number - b.stage_number
  );

  const lastResult = sortedResults[sortedResults.length - 1];
  const needResult = results.find((result) => result.stage_number === 5);

  return {
    ...call,
    date: call.created_at
      ? new Date(call.created_at).toLocaleString()
      : "",
    stageNumber: lastResult?.stage_number || call.current_stage || 1,
    stage:
      stages[(lastResult?.stage_number || call.current_stage || 1) - 1]
        ?.name || "Opening",
    lastStage:
      stages[(lastResult?.stage_number || call.current_stage || 1) - 1]
        ?.name || "Opening",
    prospectWords: needResult?.prospect_words || "",
    notes: sortedResults
      .filter((result) => result.notes)
      .map((result) => result.notes)
      .join("\n"),
    stageResults: sortedResults,
  };
}

export default function App() {
  const [stageIndex, setStageIndex] = useState(0);
  const [prospect, setProspect] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [prospectWords, setProspectWords] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState("");


  const [calls, setCalls] = useState([]);
  const [activeCallId, setActiveCallId] = useState(null);

  const [showHistory, setShowHistory] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showPhraseAnalysis, setShowPhraseAnalysis] = useState(false);

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const stage = stages[stageIndex];
  const [aiSuggestion, setAiSuggestion] = useState("");
const [aiLoading, setAiLoading] = useState(false);
async function generateObjectionResponse() {
  const objection = prospectWords.trim() || notes.trim();

  if (!objection) {
    setErrorMessage(
      "Enter the prospect's objection in the text box first."
    );
    return;
  }

  setAiLoading(true);
  setAiSuggestion("");
  setErrorMessage("");

  try {
    const result = await getObjectionSuggestion(
      objection,
      prospect,
      company
    );

    setAiSuggestion(result.suggestion);
  } catch (error) {
    setErrorMessage(`AI suggestion failed: ${error.message}`);
  } finally {
    setAiLoading(false);
  }
}

  async function refreshCalls() {
    const data = await getCalls();
    const formattedCalls = data.map(formatCallFromDatabase);
    setCalls(formattedCalls);
    return formattedCalls;
  }

  useEffect(() => {
    let mounted = true;

    async function loadCalls() {
      try {
        const data = await getCalls();

        if (mounted) {
          setCalls(data.map(formatCallFromDatabase));
          setErrorMessage("");
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(
            `Could not load saved calls. Check that your backend is running. ${error.message}`
          );
        }
      } finally {
        if (mounted) {
          setLoadingHistory(false);
        }
      }
    }

    loadCalls();

    return () => {
      mounted = false;
    };
  }, []);

  async function ensureCallExists() {
    if (activeCallId !== null) {
      return activeCallId;
    }

    const newCall = await createCall(
      prospect.trim() || "Unnamed prospect",
      company.trim() || "Company not entered"
    );

    setActiveCallId(newCall.id);
    return newCall.id;
  }

  async function saveCurrentStage(callId) {
    return saveStageResult(callId, stageIndex + 1, {
      stageOutcome: selectedOutcome,
      prospectWords: stageIndex === 4 ? prospectWords : "",
      notes,
    });
  }

  function resetCurrentCall() {
    setActiveCallId(null);
    setStageIndex(0);
    setProspect("");
    setCompany("");
    setNotes("");
    setProspectWords("");
    setSelectedOutcome("");
  }

  async function endCall() {
    if (saving) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const callId = await ensureCallExists();

      await saveCurrentStage(callId);

      await closeCall(
        callId,
        selectedOutcome || "Outcome not recorded"
      );

      await refreshCalls();

      resetCurrentCall();
      setShowHistory(true);
      setShowAnalytics(false);
      setShowPhraseAnalysis(false);
      setSuccessMessage("Call saved successfully.");
    } catch (error) {
      setErrorMessage(`Could not save the call: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function nextStage() {
    if (saving) return;

    if (stageIndex === stages.length - 1) {
      await endCall();
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const callId = await ensureCallExists();

      await saveCurrentStage(callId);

      setStageIndex((current) => current + 1);
      setSelectedOutcome("");
      setNotes("");
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(`Could not save this stage: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function navigateToStage(index) {
    if (index === stageIndex || saving) return;

    setErrorMessage("");
    setSuccessMessage("");

    // Save the current stage before navigating away.
    if (activeCallId !== null) {
      setSaving(true);

      try {
        await saveCurrentStage(activeCallId);
      } catch (error) {
        setErrorMessage(`Could not save this stage: ${error.message}`);
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }

    setStageIndex(index);
    setSelectedOutcome("");

    const existingResult = calls
      .find((call) => call.id === activeCallId)
      ?.stageResults?.find((result) => result.stage_number === index + 1);

    setNotes(existingResult?.notes || "");
    setProspectWords(existingResult?.prospect_words || "");
    setSelectedOutcome(existingResult?.stage_outcome || "");
  }

  function openScreen(screen) {
    setShowHistory(screen === "history");
    setShowAnalytics(screen === "analytics");
    setShowPhraseAnalysis(screen === "phrases");
    setErrorMessage("");
    setSuccessMessage("");
  }

  const totalCalls = calls.length;

  const wonCalls = calls.filter(
    (call) => call.outcome === "Meeting agreed"
  ).length;

  const lostCalls = calls.filter(
    (call) =>
      call.outcome === "Not interested" ||
      call.outcome === "Do not call"
  ).length;

  const callbackCalls = calls.filter(
    (call) => call.outcome === "Callback scheduled"
  ).length;

  const positiveOutcomeRate =
    totalCalls > 0
      ? (
          (calls.filter(
            (call) =>
              call.outcome === "Meeting agreed" ||
              call.outcome === "Callback scheduled"
          ).length /
            totalCalls) *
          100
        ).toFixed(1)
      : "0.0";

  const conversionRate =
    totalCalls > 0 ? ((wonCalls / totalCalls) * 100).toFixed(1) : "0.0";

  const recordedPhrases = useMemo(
    () =>
      calls
        .filter((call) => call.prospectWords?.trim())
        .map((call) => ({
          ...call,
          normalizedPhrase: call.prospectWords
            .toLowerCase()
            .replace(/[.,!?;:]/g, "")
            .replace(/\s+/g, " ")
            .trim(),
        })),
    [calls]
  );

  const recurringPhrases = useMemo(() => {
    const groups = recordedPhrases.reduce((accumulator, call) => {
      const key = call.normalizedPhrase;

      if (!accumulator[key]) {
        accumulator[key] = {
          phrase: call.prospectWords.trim(),
          count: 0,
          category:
            phraseCategories.find((item) =>
              item.pattern.test(call.prospectWords)
            )?.name || "Other",
        };
      }

      accumulator[key].count += 1;
      return accumulator;
    }, {});

    return Object.values(groups)
      .filter((item) => item.count >= 2)
      .sort((a, b) => b.count - a.count);
  }, [recordedPhrases]);

  const categoryCounts = phraseCategories.map((category) => ({
    name: category.name,
    count: recordedPhrases.filter((call) =>
      category.pattern.test(call.prospectWords)
    ).length,
  }));

  const objectionRanking = objectionPatterns
    .map((objection) => ({
      name: objection.name,
      count: calls.filter(
        (call) =>
          call.prospectWords?.trim() &&
          objection.pattern.test(call.prospectWords)
      ).length,
    }))
    .filter((objection) => objection.count > 0)
    .sort((a, b) => b.count - a.count);

  const stageCounts = stages.map((item, index) => ({
    name: item.name,
    count: calls.filter((call) => call.stageNumber === index + 1).length,
  }));

  const outcomeCounts = Object.entries(
    calls.reduce((counts, call) => {
      const outcome = call.outcome || "Outcome not recorded";
      counts[outcome] = (counts[outcome] || 0) + 1;
      return counts;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">CALL WORKSPACE</p>
          <h1>Cold Call Assistant</h1>
          <p className="subtitle">
            Stay present in the conversation. We’ll handle the structure.
          </p>
        </div>

        <nav className="app-navigation">
          <button
            className="secondary-button"
            onClick={() => openScreen("live")}
          >
            Live call
          </button>

          <button
            className="secondary-button"
            onClick={() => openScreen("history")}
          >
            Past calls ({calls.length})
          </button>

          <button
            className="secondary-button"
            onClick={() => openScreen("analytics")}
          >
            Analytics
          </button>

          <button
            className="secondary-button"
            onClick={() => openScreen("phrases")}
          >
            Phrase Analysis
          </button>
        </nav>
      </header>

      {errorMessage && (
        <div className="panel error-message" role="alert">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="panel success-message" role="status">
          {successMessage}
        </div>
      )}

      {showHistory ? (
        <section className="panel">
          <h2>Past calls</h2>
          <p className="muted">
            Calls saved to your database appear here.
          </p>

          {loadingHistory ? (
            <p className="muted">Loading saved calls...</p>
          ) : calls.length === 0 ? (
            <p className="muted">
              No saved calls yet. Complete a call to see it here.
            </p>
          ) : (
            calls.map((call) => (
              <article className="history-item" key={call.id}>
                <div>
                  <h3>{call.prospect}</h3>
                  <p>{call.company}</p>
                  <p className="muted">{call.date}</p>
                  {call.closed_at ? (
                    <p className="muted">Call completed</p>
                  ) : (
                    <p className="muted">Call not marked as closed</p>
                  )}
                </div>

                <div className="history-result">
                  <strong>
                    Last saved stage: {call.lastStage || call.stage}
                  </strong>
                  <span>{call.outcome || "Outcome not recorded"}</span>

                  {call.prospectWords && (
                    <p>
                      <strong>Prospect's exact words: </strong>
                      {call.prospectWords}
                    </p>
                  )}

                  {call.notes && (
                    <p>
                      <strong>Notes: </strong>
                      {call.notes}
                    </p>
                  )}
                </div>
              </article>
            ))
          )}

          <button
            className="primary-button"
            onClick={() => openScreen("live")}
          >
            Return to call
          </button>
        </section>
      ) : showAnalytics ? (
        <section className="panel">
          <h2>Call Analytics</h2>
          <p className="muted">
            Analyze where calls end and what prospects say.
          </p>

          <div className="analytics-metrics">
            <div className="metric-card">
              <p className="metric-label">Total Calls</p>
              <p className="metric-value">{totalCalls}</p>
            </div>

            <div className="metric-card">
              <p className="metric-label">Meetings Booked</p>
              <p className="metric-value">{wonCalls}</p>
            </div>

            <div className="metric-card">
              <p className="metric-label">Callbacks Scheduled</p>
              <p className="metric-value">{callbackCalls}</p>
            </div>

            <div className="metric-card">
              <p className="metric-label">Positive Outcome Rate</p>
              <p className="metric-value">{positiveOutcomeRate}%</p>
            </div>

            <div className="metric-card">
              <p className="metric-label">Won Calls</p>
              <p className="metric-value">{wonCalls}</p>
            </div>

            <div className="metric-card">
              <p className="metric-label">Lost Calls</p>
              <p className="metric-value">{lostCalls}</p>
            </div>

            <div className="metric-card">
              <p className="metric-label">Meeting Conversion Rate</p>
              <p className="metric-value">{conversionRate}%</p>
            </div>
          </div>

          <h3>Where calls ended</h3>

          {stageCounts.map((item, index) => {
            const maxCount = Math.max(
              1,
              ...stageCounts.map((stageItem) => stageItem.count)
            );

            return (
              <div className="history-item" key={item.name}>
                <div style={{ flex: 1 }}>
                  <p>
                    Stage {index + 1}: {item.name}
                  </p>
                  <div
                    style={{
                      height: "8px",
                      background: "#e5e7eb",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${(item.count / maxCount) * 100}%`,
                        background: "linear-gradient(90deg, #5267e8, #8295ff)",
                        borderRadius: "8px",
                      }}
                    />
                  </div>
                </div>
                <strong>{item.count}</strong>
              </div>
            );
          })}

          <h3>Call outcomes</h3>

          {outcomeCounts.length === 0 ? (
            <p className="muted">
              Complete a call to see outcome analytics.
            </p>
          ) : (
            outcomeCounts.map(([outcome, count]) => (
              <div className="history-item" key={outcome}>
                <span>{outcome}</span>
                <strong>{count}</strong>
              </div>
            ))
          )}

          <button
            className="primary-button"
            onClick={() => openScreen("live")}
          >
            Return to call
          </button>
        </section>
      ) : showPhraseAnalysis ? (
        <section className="panel">
          <h2>Prospect Phrase Analysis</h2>
          <p className="muted">
            Review the exact words prospects use during your calls.
          </p>

          <p>
            Total calls with recorded prospect words:{" "}
            {recordedPhrases.length}
          </p>

          <div className="analytics-metrics">
            {categoryCounts.map((category) => (
              <div className="metric-card" key={category.name}>
                <p className="metric-label">{category.name}</p>
                <p className="metric-value">{category.count}</p>
              </div>
            ))}

            <div className="metric-card">
              <p className="metric-label">Questions</p>
              <p className="metric-value">
                {
                  recordedPhrases.filter((call) =>
                    /\b(what|why|how|when|where|who|which)\b/i.test(
                      call.prospectWords
                    )
                  ).length
                }
              </p>
            </div>
          </div>

          <h3>Most Common Objections</h3>

          {objectionRanking.length === 0 ? (
            <p className="muted">
              No objections detected yet. Record the prospect's exact words
              during your calls to see the ranking.
            </p>
          ) : (
            <div className="analytics-metrics">
              {objectionRanking.map((objection, index) => (
                <div className="metric-card" key={objection.name}>
                  <p className="metric-label">
                    {index + 1}. {objection.name}
                  </p>
                  <p className="metric-value">{objection.count}</p>
                  <p className="muted">
                    Suggested response:{" "}
                    {objectionResponses[objection.name] ||
                      "Ask an open-ended question to understand the prospect's concern."}
                  </p>
                </div>
              ))}
            </div>
          )}

          <h3>Recurring Phrases</h3>

          {recurringPhrases.length === 0 ? (
            <p className="muted">
              No repeated phrases yet. The same phrase must appear in at least
              two saved calls.
            </p>
          ) : (
            recurringPhrases.map((item) => (
              <article
                className="history-item"
                key={item.phrase.toLowerCase()}
              >
                <div>
                  <h4>{item.category}</h4>
                  <p>{item.phrase}</p>
                  <p className="muted">
                    Repeated in {item.count} calls
                  </p>
                </div>
              </article>
            ))
          )}

          <h3>Recorded Prospect Phrases</h3>

          {recordedPhrases.length === 0 ? (
            <p className="muted">
              No prospect phrases recorded yet. Enter the prospect's exact
              words during Stage 5.
            </p>
          ) : (
            recordedPhrases.map((call) => (
              <article className="history-item" key={call.id}>
                <div>
                  <h3>{call.prospect}</h3>
                  <p>
                    <strong>Exact words: </strong>
                    {call.prospectWords}
                  </p>
                  <p className="muted">
                    Stage: {call.stage} | Outcome:{" "}
                    {call.outcome || "Outcome not recorded"}
                  </p>
                </div>
              </article>
            ))
          )}

          <button
            className="secondary-button"
            onClick={() => openScreen("live")}
          >
            Return to call
          </button>
        </section>
      ) : (
        <div className="workspace">
          <section className="panel caller-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">CURRENT CALL</p>
                <h2>Prospect details</h2>
              </div>
              <span className="live-badge">● LIVE WORKSPACE</span>
            </div>

            <div className="field-grid">
              <label>
                Prospect name
                <input
                  value={prospect}
                  onChange={(event) => setProspect(event.target.value)}
                  placeholder="e.g. Dr. Anjali Menon"
                  disabled={activeCallId !== null}
                />
              </label>

              <label>
                Company
                <input
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder="e.g. Menon Family Clinic"
                  disabled={activeCallId !== null}
                />
              </label>
            </div>

            <div className="stage-progress">
              {stages.map((item, index) => (
                <button
                  key={item.name}
                  className={`stage-dot ${
                    index === stageIndex ? "active" : ""
                  } ${index < stageIndex ? "completed" : ""}`}
                  onClick={() => navigateToStage(index)}
                  title={item.name}
                  disabled={saving}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <div className="stage-content">
              <p className="eyebrow">STAGE {stageIndex + 1} OF 8</p>
              <h2>{stage.name}</h2>
              <p className="purpose">{stage.purpose}</p>

              <h3 className="small-heading">WHAT THE PROSPECT MAY SAY</h3>

              <div className="examples">
                {stage.examples.map((example) => (
                  <div className="example" key={example}>
                    “{example}”
                  </div>
                ))}
              </div>

              <h3 className="small-heading">WHAT HAPPENED?</h3>

 
<div className="outcomes">
  {outcomesByStage[stageIndex].map((outcome) => (
    <button
      key={outcome}
      className={`outcome-button ${
        selectedOutcome === outcome ? "selected" : ""
      }`}
      onClick={() => setSelectedOutcome(outcome)}
      disabled={saving}
    >
      {outcome}
    </button>
  ))}
</div>

{stageIndex === 4 ? (
  <label className="notes-label">
    PROSPECT'S EXACT WORDS
    <textarea
      value={prospectWords}
      onChange={(event) => setProspectWords(event.target.value)}
      placeholder="Write exactly what the prospect says about their needs..."
      rows={3}
      disabled={saving}
    />
  </label>
) : (
  <label className="notes-label">
    CALL NOTES
    <textarea
      value={notes}
      onChange={(event) => setNotes(event.target.value)}
      placeholder="Capture the important details..."
      rows={3}
      disabled={saving}
    />
  </label>
)}

{stageIndex === 5 && (
  <div className="ai-suggestion-section">
    <button
      type="button"
      className="secondary-button"
      onClick={generateObjectionResponse}
      disabled={aiLoading}
    >
      {aiLoading ? "Generating suggestion..." : "✨ Suggest an AI response"}
    </button>

    {aiSuggestion && (
      <div className="panel">
        <h3>Gemini suggestion</h3>
        <p>{aiSuggestion}</p>
        <p className="muted">
          Use your judgment and adapt the response to the conversation.
        </p>
      </div>
    )}
  </div>
)}


              <div className="call-actions">
                <button
                  className="primary-button"
                  onClick={nextStage}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : stageIndex === 7
                      ? "SAVE & CLOSE CALL"
                      : `NEXT: ${stages[stageIndex + 1].name.toUpperCase()}`}
                </button>

                <button
                  className="end-button"
                  onClick={endCall}
                  disabled={saving}
                >
                  End call
                </button>
              </div>
            </div>
          </section>

          <aside className="panel side-panel">
            <p className="eyebrow">YOUR CALL GUIDE</p>
            <h2>Eight stages. One conversation.</h2>
            <p className="muted">
              Most calls end early. Record what happened accurately and move
              on without losing the prospect's words.
            </p>

            {stages.map((item, index) => (
              <button
                key={item.name}
                className={`stage-list-item ${
                  index === stageIndex ? "current" : ""
                }`}
                onClick={() => navigateToStage(index)}
                disabled={saving}
              >
                <span>{index + 1}</span>
                <span>{item.name}</span>
                <span>{index === stageIndex ? "NOW" : ""}</span>
              </button>
            ))}
          </aside>
        </div>
      )}
    </main>
  );
}
