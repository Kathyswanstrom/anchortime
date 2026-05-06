"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Play, Square, Plus, Download, Trash2, Clock, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DEFAULT_CLIENTS = [
  { id: "residex-david", name: "Residex – David", rate: 125, increment: 0.1 },
  { id: "residex-rebecca", name: "Residex – Rebecca", rate: 125, increment: 0.1 },
  { id: "residex-implementation", name: "Residex – Implementation", rate: 125, increment: 0.1 },
  { id: "aspen-leaf", name: "Aspen Leaf", rate: 95, increment: 0.1 },
  { id: "other", name: "Other Client", rate: 125, increment: 0.1, editable: true },
];

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function roundHours(milliseconds, increment) {
  const rawHours = milliseconds / 1000 / 60 / 60;
  return Math.ceil(rawHours / increment) * increment;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function money(value) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function AnchorTimePhaseOne() {
  const [clients, setClients] = useState(DEFAULT_CLIENTS);
  const [activeClientId, setActiveClientId] = useState(DEFAULT_CLIENTS[0].id);
  const [otherClientName, setOtherClientName] = useState("");
  const [activeTimer, setActiveTimer] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [stopDraft, setStopDraft] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [manual, setManual] = useState({ date: todayString(), activity: "Computer Work", hours: "0.1", notes: "", billable: true });

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeClient = clients.find((c) => c.id === activeClientId) || clients[0];
  const displayClientName = activeClient.id === "other" && otherClientName.trim() ? otherClientName.trim() : activeClient.name;

  const runningMs = activeTimer ? now - activeTimer.startedAt : 0;
  const roundedHours = activeTimer ? roundHours(runningMs, activeClient.increment) : 0;

  const totals = useMemo(() => {
    const hours = entries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
    const amount = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return { hours, amount };
  }, [entries]);

  function updateClient(field, value) {
    setClients((prev) => prev.map((c) => (c.id === activeClientId ? { ...c, [field]: value } : c)));
  }

  function startTimer(activity) {
    if (activeTimer) return;
    setActiveTimer({ clientId: activeClientId, clientName: displayClientName, activity, startedAt: Date.now() });
  }

  function stopTimer() {
    if (!activeTimer) return;
    const client = clients.find((c) => c.id === activeTimer.clientId) || activeClient;
    const elapsed = Date.now() - activeTimer.startedAt;
    const hours = roundHours(elapsed, client.increment);
    setStopDraft({
      date: todayString(),
      clientId: activeTimer.clientId,
      clientName: activeTimer.clientName,
      activity: activeTimer.activity,
      elapsed,
      hours,
      rate: client.rate,
      billable: true,
      notes: "",
    });
    setActiveTimer(null);
  }

  function saveStopDraft() {
    if (!stopDraft) return;
    const amount = stopDraft.billable ? Number(stopDraft.hours) * Number(stopDraft.rate) : 0;
    setEntries((prev) => [{ ...stopDraft, id: crypto.randomUUID(), amount }, ...prev]);
    setStopDraft(null);
  }

  function saveManualEntry() {
    const hours = Number(manual.hours || 0);
    const rate = Number(activeClient.rate || 0);
    const amount = manual.billable ? hours * rate : 0;
    setEntries((prev) => [
      {
        id: crypto.randomUUID(),
        date: manual.date || todayString(),
        clientId: activeClientId,
        clientName: displayClientName,
        activity: manual.activity,
        elapsed: hours * 60 * 60 * 1000,
        hours,
        rate,
        billable: manual.billable,
        notes: manual.notes,
        amount,
      },
      ...prev,
    ]);
    setManual({ date: todayString(), activity: "Computer Work", hours: "0.1", notes: "", billable: true });
    setManualOpen(false);
  }

  function exportCSV() {
    const header = ["Date", "Client", "Activity", "Hours", "Rate", "Billable", "Amount", "Notes"];
    const rows = entries.map((e) => [e.date, e.clientName, e.activity, e.hours, e.rate, e.billable ? "Yes" : "No", e.amount.toFixed(2), e.notes]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anchortime-billing-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AnchorTime</h1>
            <p className="text-slate-600">Phase 1 billing timer for calls, computer work, notes, rates, and export.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setManualOpen(true)} className="rounded-2xl">
              <Plus className="mr-2 h-4 w-4" /> Manual Entry
            </Button>
            <Button onClick={exportCSV} className="rounded-2xl" disabled={!entries.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => setActiveClientId(client.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-medium shadow-sm transition ${
                activeClientId === client.id ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {client.name}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-600">Client / Account</span>
                  {activeClient.id === "other" ? (
                    <input
                      className="w-full rounded-2xl border p-3"
                      placeholder="Enter client name"
                      value={otherClientName}
                      onChange={(e) => setOtherClientName(e.target.value)}
                    />
                  ) : (
                    <div className="rounded-2xl border bg-slate-50 p-3 font-semibold">{activeClient.name}</div>
                  )}
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-600">Hourly Rate</span>
                  <div className="flex items-center rounded-2xl border bg-white px-3">
                    <span className="text-slate-500">$</span>
                    <input
                      type="number"
                      className="w-full p-3 outline-none"
                      value={activeClient.rate}
                      onChange={(e) => updateClient("rate", Number(e.target.value))}
                    />
                  </div>
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-600">Billing Increment</span>
                  <select
                    className="w-full rounded-2xl border bg-white p-3"
                    value={activeClient.increment}
                    onChange={(e) => updateClient("increment", Number(e.target.value))}
                  >
                    <option value={0.1}>6 minutes / 0.1 hr</option>
                    <option value={0.25}>15 minutes / 0.25 hr</option>
                    <option value={0.5}>30 minutes / 0.5 hr</option>
                    <option value={1 / 60}>Exact minutes</option>
                  </select>
                </label>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-inner">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Current Timer</p>
                    <h2 className="text-2xl font-bold">{activeTimer ? activeTimer.activity : "No timer running"}</h2>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-4xl font-bold">{activeTimer ? formatElapsed(runningMs) : "00:00:00"}</div>
                    <p className="text-sm text-slate-500">Rounded: {activeTimer ? roundedHours.toFixed(2) : "0.00"} hr</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Button disabled={!!activeTimer} onClick={() => startTimer("Phone Call")} className="h-20 rounded-3xl text-lg">
                    <Play className="mr-2 h-5 w-5" /> Start Phone Call
                  </Button>
                  <Button disabled={!!activeTimer} onClick={() => startTimer("Computer Work")} className="h-20 rounded-3xl text-lg">
                    <Play className="mr-2 h-5 w-5" /> Start Computer Work
                  </Button>
                </div>

                <Button disabled={!activeTimer} variant="destructive" onClick={stopTimer} className="mt-3 h-14 w-full rounded-3xl text-lg">
                  <Square className="mr-2 h-5 w-5" /> End Timer & Add Note
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="rounded-3xl shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <Clock className="h-6 w-6" />
                  <div>
                    <p className="text-sm text-slate-500">Total Logged</p>
                    <p className="text-2xl font-bold">{totals.hours.toFixed(2)} hrs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-3xl shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6" />
                  <div>
                    <p className="text-sm text-slate-500">Estimated Billable</p>
                    <p className="text-2xl font-bold">{money(totals.amount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="rounded-3xl shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Billing Log</h2>
              <p className="text-sm text-slate-500">Newest entries first</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-3">Date</th>
                    <th>Client</th>
                    <th>Activity</th>
                    <th>Hours</th>
                    <th>Rate</th>
                    <th>Amount</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-500">No entries yet.</td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id} className="border-b align-top">
                        <td className="py-3">{entry.date}</td>
                        <td>{entry.clientName}</td>
                        <td>{entry.activity}</td>
                        <td>{Number(entry.hours).toFixed(2)}</td>
                        <td>{money(Number(entry.rate))}</td>
                        <td>{money(Number(entry.amount))}</td>
                        <td className="max-w-sm">{entry.notes}</td>
                        <td>
                          <button onClick={() => setEntries((prev) => prev.filter((e) => e.id !== entry.id))} className="text-slate-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {stopDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-2xl font-bold">Finish Time Entry</h2>
            <p className="mb-4 text-slate-600">{stopDraft.clientName} • {stopDraft.activity} • {Number(stopDraft.hours).toFixed(2)} hrs</p>
            <label className="mb-3 block space-y-1">
              <span className="text-sm font-medium text-slate-600">End Note</span>
              <textarea
                className="h-28 w-full rounded-2xl border p-3"
                placeholder="Example: Phone call with David about implementation partner next steps."
                value={stopDraft.notes}
                onChange={(e) => setStopDraft({ ...stopDraft, notes: e.target.value })}
              />
            </label>
            <label className="mb-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={stopDraft.billable} onChange={(e) => setStopDraft({ ...stopDraft, billable: e.target.checked })} />
              Billable
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStopDraft(null)} className="rounded-2xl">Cancel</Button>
              <Button onClick={saveStopDraft} className="rounded-2xl">Save Entry</Button>
            </div>
          </div>
        </div>
      )}

      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-2xl font-bold">Manual Time Entry</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-600">Date</span>
                <input type="date" className="w-full rounded-2xl border p-3" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-600">Hours</span>
                <input type="number" step="0.1" className="w-full rounded-2xl border p-3" value={manual.hours} onChange={(e) => setManual({ ...manual, hours: e.target.value })} />
              </label>
            </div>
            <label className="mt-3 block space-y-1">
              <span className="text-sm font-medium text-slate-600">Activity</span>
              <select className="w-full rounded-2xl border p-3" value={manual.activity} onChange={(e) => setManual({ ...manual, activity: e.target.value })}>
                <option>Phone Call</option>
                <option>Computer Work</option>
              </select>
            </label>
            <label className="mt-3 block space-y-1">
              <span className="text-sm font-medium text-slate-600">Notes</span>
              <textarea className="h-24 w-full rounded-2xl border p-3" value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} />
            </label>
            <label className="my-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={manual.billable} onChange={(e) => setManual({ ...manual, billable: e.target.checked })} />
              Billable
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManualOpen(false)} className="rounded-2xl">Cancel</Button>
              <Button onClick={saveManualEntry} className="rounded-2xl">Save Manual Entry</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
