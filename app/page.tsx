"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Play,
  Square,
  Plus,
  Download,
  Trash2,
  Clock,
  FileText,
  Printer,
  UserPlus,
  Pencil,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

type Client = {
  id: string;
  name: string;
  rate: number;
  increment: number;
  editable?: boolean;
};

type Timer = {
  clientId: string;
  clientName: string;
  activity: string;
  startedAt: number;
};

type Entry = {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  activity: string;
  elapsed: number;
  hours: number;
  rate: number;
  billable: boolean;
  notes: string;
  amount: number;
};

const ACTIVITY_OPTIONS = [
  "Phone Call",
  "Computer Work",
  "In Person Meeting",
  "Conference",
  "Marketing",
  "Custom Activity",
];

const DEFAULT_CLIENTS: Client[] = [
  { id: "residex-david", name: "Residex – David", rate: 125, increment: 0.1 },
  { id: "residex-rebecca", name: "Residex – Rebecca", rate: 125, increment: 0.1 },
  { id: "residex-implementation", name: "Residex – Implementation", rate: 125, increment: 0.1 },
  { id: "aspen-leaf", name: "Aspen Leaf", rate: 95, increment: 0.1 },
  { id: "other", name: "Other Client", rate: 125, increment: 0.1, editable: true },
];

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function roundHours(milliseconds: number, increment: number) {
  const rawHours = milliseconds / 1000 / 60 / 60;
  return Math.ceil(rawHours / increment) * increment;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number) {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function mapSupabaseEntry(row: any): Entry {
  return {
    id: row.id,
    date: row.created_at ? row.created_at.slice(0, 10) : todayString(),
    clientId: row.client_id || "",
    clientName: row.client_name || "Unknown Client",
    activity: row.activity || "",
    elapsed: 0,
    hours: Number(row.hours || 0),
    rate: row.hours ? Number(row.amount || 0) / Number(row.hours || 1) : 0,
    billable: row.billable ?? true,
    notes: row.notes || "",
    amount: Number(row.amount || 0),
  };
}

export default function AnchorTimeApp() {
  const [clients, setClients] = useState<Client[]>(DEFAULT_CLIENTS);
  const [activeClientId, setActiveClientId] = useState(DEFAULT_CLIENTS[0].id);
  const [otherClientName, setOtherClientName] = useState("");
  const [selectedActivity, setSelectedActivity] = useState("Computer Work");
  const [customTimerActivity, setCustomTimerActivity] = useState("");
  const [activeTimer, setActiveTimer] = useState<Timer | null>(null);
  const [now, setNow] = useState(Date.now());
  const [stopDraft, setStopDraft] = useState<Entry | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [clientManagerOpen, setClientManagerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [saveError, setSaveError] = useState("");

  const [manual, setManual] = useState({
    date: todayString(),
    activity: "Computer Work",
    customActivity: "",
    hours: "0.1",
    notes: "",
    billable: true,
  });

  const [newClient, setNewClient] = useState({
    name: "",
    rate: "125",
    increment: "0.1",
  });

  const [invoiceFilters, setInvoiceFilters] = useState({
    clientName: "All Clients",
    startDate: "",
    endDate: "",
    invoiceNumber: `INV-${todayString().replaceAll("-", "")}`,
    paymentTerms: "Due upon receipt",
  });

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadEntries();
    loadClients();
  }, []);

  async function loadEntries() {
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setSaveError(error.message);
      return;
    }

    setEntries((data || []).map(mapSupabaseEntry));
  }

  async function loadClients() {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    const savedClients: Client[] = (data || []).map((client: any) => ({
      id: client.id,
      name: client.name,
      rate: Number(client.hourly_rate || 0),
      increment: Number(client.billing_increment || 0.1),
    }));

    const savedNames = new Set(savedClients.map((client) => client.name));
    const defaultsNotDuplicated = DEFAULT_CLIENTS.filter(
      (client) => !savedNames.has(client.name)
    );

    setClients([...defaultsNotDuplicated, ...savedClients]);
  }

  async function addClient() {
    setSaveError("");

    const name = newClient.name.trim();

    if (!name) {
      setSaveError("Please enter a client name.");
      return;
    }

    const rate = Number(newClient.rate || 0);
    const increment = Number(newClient.increment || 0.1);

    const { data, error } = await supabase
      .from("clients")
      .insert([
        {
          name,
          hourly_rate: rate,
          billing_increment: increment,
        },
      ])
      .select("*")
      .single();

    if (error) {
      console.error(error);
      setSaveError(error.message);
      return;
    }

    const savedClient: Client = {
      id: data.id,
      name: data.name,
      rate: Number(data.hourly_rate || rate),
      increment: Number(data.billing_increment || increment),
    };

    setClients((prev) => [...prev, savedClient]);
    setActiveClientId(savedClient.id);
    setNewClient({ name: "", rate: "125", increment: "0.1" });
  }

  async function deleteClient(clientId: string) {
    const defaultClient = DEFAULT_CLIENTS.find((client) => client.id === clientId);

    if (defaultClient) {
      setSaveError("Default clients cannot be deleted yet.");
      return;
    }

    const { error } = await supabase.from("clients").delete().eq("id", clientId);

    if (error) {
      console.error(error);
      setSaveError(error.message);
      return;
    }

    setClients((prev) => prev.filter((client) => client.id !== clientId));

    if (activeClientId === clientId) {
      setActiveClientId(DEFAULT_CLIENTS[0].id);
    }
  }

  const activeClient = clients.find((c) => c.id === activeClientId) || clients[0];

  const displayClientName =
    activeClient.id === "other" && otherClientName.trim()
      ? otherClientName.trim()
      : activeClient.name;

  const timerActivity =
    selectedActivity === "Custom Activity"
      ? customTimerActivity.trim() || "Custom Activity"
      : selectedActivity;

  const runningMs = activeTimer ? now - activeTimer.startedAt : 0;

  const roundedHours = activeTimer
    ? roundHours(runningMs, activeClient.increment)
    : 0;

  const clientNames = useMemo(() => {
    const names = new Set<string>();
    entries.forEach((entry) => names.add(entry.clientName));
    clients.forEach((client) => names.add(client.name));
    return ["All Clients", ...Array.from(names).filter(Boolean).sort()];
  }, [entries, clients]);

  const totals = useMemo(() => {
    const hours = entries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
    const amount = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return { hours, amount };
  }, [entries]);

  const invoiceEntries = useMemo(() => {
    return entries.filter((entry) => {
      const clientMatch =
        invoiceFilters.clientName === "All Clients" ||
        entry.clientName === invoiceFilters.clientName;

      const startMatch = !invoiceFilters.startDate || entry.date >= invoiceFilters.startDate;
      const endMatch = !invoiceFilters.endDate || entry.date <= invoiceFilters.endDate;

      return clientMatch && startMatch && endMatch && entry.billable;
    });
  }, [entries, invoiceFilters]);

  const invoiceTotals = useMemo(() => {
    const hours = invoiceEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
    const amount = invoiceEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return { hours, amount };
  }, [invoiceEntries]);

  function updateClient(field: "rate" | "increment", value: number) {
    setClients((prev) =>
      prev.map((c) =>
        c.id === activeClientId
          ? {
              ...c,
              [field]: value,
            }
          : c
      )
    );
  }

  function startTimer() {
    if (activeTimer) return;

    if (selectedActivity === "Custom Activity" && !customTimerActivity.trim()) {
      setSaveError("Please enter a custom activity before starting the timer.");
      return;
    }

    setSaveError("");

    setActiveTimer({
      clientId: activeClientId,
      clientName: displayClientName,
      activity: timerActivity,
      startedAt: Date.now(),
    });
  }

  function stopTimer() {
    if (!activeTimer) return;

    const client = clients.find((c) => c.id === activeTimer.clientId) || activeClient;
    const elapsed = Date.now() - activeTimer.startedAt;
    const hours = roundHours(elapsed, client.increment);

    setStopDraft({
      id: crypto.randomUUID(),
      date: todayString(),
      clientId: activeTimer.clientId,
      clientName: activeTimer.clientName,
      activity: activeTimer.activity,
      elapsed,
      hours,
      rate: client.rate,
      billable: true,
      notes: "",
      amount: 0,
    });

    setActiveTimer(null);
  }

  async function saveEntryToSupabase(entry: Entry) {
    const startTime = entry.elapsed
      ? new Date(Date.now() - entry.elapsed).toISOString()
      : null;

    const endTime = new Date().toISOString();

    const { data, error } = await supabase
      .from("time_entries")
      .insert([
        {
          client_name: entry.clientName,
          activity: entry.activity,
          start_time: startTime,
          end_time: endTime,
          hours: entry.hours,
          notes: entry.notes,
          billable: entry.billable,
          amount: entry.amount,
        },
      ])
      .select("*")
      .single();

    if (error) {
      console.error(error);
      setSaveError(error.message);
      return null;
    }

    return data ? mapSupabaseEntry(data) : entry;
  }

  async function saveStopDraft() {
    if (!stopDraft) return;

    setSaveError("");

    const amount = stopDraft.billable
      ? Number(stopDraft.hours) * Number(stopDraft.rate)
      : 0;

    const newEntry = {
      ...stopDraft,
      amount,
    };

    const savedEntry = await saveEntryToSupabase(newEntry);

    if (!savedEntry) return;

    setEntries((prev) => [savedEntry, ...prev]);
    setStopDraft(null);
  }

  async function saveManualEntry() {
    setSaveError("");

    const hours = Number(manual.hours || 0);
    const rate = Number(activeClient.rate || 0);
    const amount = manual.billable ? hours * rate : 0;

    const activity =
      manual.activity === "Custom Activity"
        ? manual.customActivity.trim() || "Custom Activity"
        : manual.activity;

    if (manual.activity === "Custom Activity" && !manual.customActivity.trim()) {
      setSaveError("Please enter a custom activity for the manual entry.");
      return;
    }

    const newEntry: Entry = {
      id: crypto.randomUUID(),
      date: manual.date || todayString(),
      clientId: activeClientId,
      clientName: displayClientName,
      activity,
      elapsed: hours * 60 * 60 * 1000,
      hours,
      rate,
      billable: manual.billable,
      notes: manual.notes,
      amount,
    };

    const savedEntry = await saveEntryToSupabase(newEntry);

    if (!savedEntry) return;

    setEntries((prev) => [savedEntry, ...prev]);

    setManual({
      date: todayString(),
      activity: "Computer Work",
      customActivity: "",
      hours: "0.1",
      notes: "",
      billable: true,
    });

    setManualOpen(false);
  }

  async function saveEditedEntry() {
    if (!editingEntry) return;

    setSaveError("");

    const updatedAmount = editingEntry.billable
      ? Number(editingEntry.hours) * Number(editingEntry.rate)
      : 0;

    const { error } = await supabase
      .from("time_entries")
      .update({
        client_name: editingEntry.clientName,
        activity: editingEntry.activity,
        hours: editingEntry.hours,
        notes: editingEntry.notes,
        billable: editingEntry.billable,
        amount: updatedAmount,
      })
      .eq("id", editingEntry.id);

    if (error) {
      console.error(error);
      setSaveError(error.message);
      return;
    }

    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === editingEntry.id
          ? { ...editingEntry, amount: updatedAmount }
          : entry
      )
    );

    setEditingEntry(null);
  }

  async function deleteEntry(entryId: string) {
    setSaveError("");

    const { error } = await supabase.from("time_entries").delete().eq("id", entryId);

    if (error) {
      console.error(error);
      setSaveError(error.message);
      return;
    }

    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  }

  function exportCSV() {
    const header = ["Date", "Client", "Activity", "Hours", "Rate", "Billable", "Amount", "Notes"];

    const rows = entries.map((e) => [
      e.date,
      e.clientName,
      e.activity,
      e.hours,
      e.rate,
      e.billable ? "Yes" : "No",
      e.amount.toFixed(2),
      e.notes,
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "anchortime-billing-log.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  function printInvoice() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-print-area, #invoice-print-area * { visibility: visible; }
          #invoice-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 24px;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-6xl space-y-5 no-print">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AnchorTime</h1>
            <p className="text-slate-600">
              Billing timer for calls, computer work, meetings, conferences, marketing, notes, invoices, and export.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setClientManagerOpen(true)} className="rounded-2xl">
              <UserPlus className="mr-2 h-4 w-4" /> Clients
            </Button>

            <Button variant="outline" onClick={() => setInvoiceOpen(true)} className="rounded-2xl">
              <FileText className="mr-2 h-4 w-4" /> Invoice
            </Button>

            <Button variant="outline" onClick={() => setManualOpen(true)} className="rounded-2xl">
              <Plus className="mr-2 h-4 w-4" /> Manual Entry
            </Button>

            <Button onClick={exportCSV} className="rounded-2xl" disabled={!entries.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        {saveError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Supabase error: {saveError}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => setActiveClientId(client.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-medium shadow-sm transition ${
                activeClientId === client.id
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-100"
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
                    <div className="rounded-2xl border bg-slate-50 p-3 font-semibold">
                      {activeClient.name}
                    </div>
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
                <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr]">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-600">Activity</span>

                    <select
                      className="w-full rounded-2xl border p-3"
                      value={selectedActivity}
                      onChange={(e) => {
                        setSelectedActivity(e.target.value);
                        if (e.target.value !== "Custom Activity") {
                          setCustomTimerActivity("");
                        }
                      }}
                    >
                      {ACTIVITY_OPTIONS.map((activity) => (
                        <option key={activity}>{activity}</option>
                      ))}
                    </select>
                  </label>

                  {selectedActivity === "Custom Activity" && (
                    <label className="space-y-1">
                      <span className="text-sm font-medium text-slate-600">Custom Activity</span>

                      <input
                        className="w-full rounded-2xl border p-3"
                        placeholder="Enter custom activity"
                        value={customTimerActivity}
                        onChange={(e) => setCustomTimerActivity(e.target.value)}
                      />
                    </label>
                  )}
                </div>

                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                      Current Timer
                    </p>

                    <h2 className="text-2xl font-bold">
                      {activeTimer ? activeTimer.activity : "No timer running"}
                    </h2>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-4xl font-bold">
                      {activeTimer ? formatElapsed(runningMs) : "00:00:00"}
                    </div>

                    <p className="text-sm text-slate-500">
                      Rounded: {activeTimer ? roundedHours.toFixed(2) : "0.00"} hr
                    </p>
                  </div>
                </div>

                <Button disabled={!!activeTimer} onClick={startTimer} className="h-20 w-full rounded-3xl text-lg">
                  <Play className="mr-2 h-5 w-5" /> Start Selected Activity
                </Button>

                <Button
                  disabled={!activeTimer}
                  variant="destructive"
                  onClick={stopTimer}
                  className="mt-3 h-14 w-full rounded-3xl text-lg"
                >
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
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No entries yet.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id} className="border-b align-top">
                        <td className="py-3">{entry.date}</td>
                        <td>{entry.clientName}</td>
                        <td>{entry.activity}</td>
                        <td>{entry.hours.toFixed(2)}</td>
                        <td>{money(entry.rate)}</td>
                        <td>{money(entry.amount)}</td>
                        <td className="max-w-sm">{entry.notes}</td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingEntry(entry)}
                              className="text-slate-400 hover:text-blue-600"
                              title="Edit entry"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="text-slate-400 hover:text-red-600"
                              title="Delete entry"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
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

      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-2xl font-bold">Edit Time Entry</h2>

            <label className="mb-3 block space-y-1">
              <span className="text-sm font-medium text-slate-600">Client</span>
              <input
                className="w-full rounded-2xl border p-3"
                value={editingEntry.clientName}
                onChange={(e) =>
                  setEditingEntry({ ...editingEntry, clientName: e.target.value })
                }
              />
            </label>

            <label className="mb-3 block space-y-1">
              <span className="text-sm font-medium text-slate-600">Activity</span>
              <input
                className="w-full rounded-2xl border p-3"
                value={editingEntry.activity}
                onChange={(e) =>
                  setEditingEntry({ ...editingEntry, activity: e.target.value })
                }
              />
            </label>

            <div className="mb-3 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-600">Hours</span>
                <input
                  type="number"
                  step="0.1"
                  className="w-full rounded-2xl border p-3"
                  value={editingEntry.hours}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, hours: Number(e.target.value) })
                  }
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-600">Rate</span>
                <input
                  type="number"
                  step="1"
                  className="w-full rounded-2xl border p-3"
                  value={editingEntry.rate}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, rate: Number(e.target.value) })
                  }
                />
              </label>
            </div>

            <label className="mb-3 block space-y-1">
              <span className="text-sm font-medium text-slate-600">Notes</span>
              <textarea
                className="h-24 w-full rounded-2xl border p-3"
                value={editingEntry.notes}
                onChange={(e) =>
                  setEditingEntry({ ...editingEntry, notes: e.target.value })
                }
              />
            </label>

            <label className="mb-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editingEntry.billable}
                onChange={(e) =>
                  setEditingEntry({ ...editingEntry, billable: e.target.checked })
                }
              />
              Billable
            </label>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingEntry(null)}
                className="rounded-2xl"
              >
                Cancel
              </Button>

              <Button onClick={saveEditedEntry} className="rounded-2xl">
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {clientManagerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 no-print">
          <div className="mx-auto my-6 max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">Client Manager</h2>
                <p className="text-slate-600">
                  Add clients, rates, and billing increments. New clients become tabs.
                </p>
              </div>

              <Button variant="outline" onClick={() => setClientManagerOpen(false)} className="rounded-2xl">
                Close
              </Button>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-4">
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-slate-600">Client Name</span>
                <input
                  className="w-full rounded-2xl border p-3"
                  placeholder="Example: New Consulting Client"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-600">Hourly Rate</span>
                <input
                  type="number"
                  className="w-full rounded-2xl border p-3"
                  value={newClient.rate}
                  onChange={(e) => setNewClient({ ...newClient, rate: e.target.value })}
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-600">Increment</span>
                <select
                  className="w-full rounded-2xl border p-3"
                  value={newClient.increment}
                  onChange={(e) => setNewClient({ ...newClient, increment: e.target.value })}
                >
                  <option value="0.1">6 minutes</option>
                  <option value="0.25">15 minutes</option>
                  <option value="0.5">30 minutes</option>
                  <option value={String(1 / 60)}>Exact minutes</option>
                </select>
              </label>
            </div>

            <Button onClick={addClient} className="mb-6 rounded-2xl">
              <Plus className="mr-2 h-4 w-4" /> Add Client
            </Button>

            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-500">
                    <th className="p-3">Client</th>
                    <th className="p-3">Rate</th>
                    <th className="p-3">Increment</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {clients.map((client) => {
                    const isDefault = !!DEFAULT_CLIENTS.find(
                      (defaultClient) => defaultClient.id === client.id
                    );

                    return (
                      <tr key={client.id} className="border-b align-top">
                        <td className="p-3 font-medium">{client.name}</td>
                        <td className="p-3">{money(client.rate)}</td>
                        <td className="p-3">
                          {client.increment === 0.1
                            ? "6 minutes"
                            : client.increment === 0.25
                            ? "15 minutes"
                            : client.increment === 0.5
                            ? "30 minutes"
                            : "Exact minutes"}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="outline"
                            className="rounded-2xl"
                            disabled={isDefault}
                            onClick={() => deleteClient(client.id)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {invoiceOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 no-print">
          <div className="mx-auto my-6 max-w-5xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Invoice Generator</h2>
                <p className="text-slate-600">
                  Filter your billable entries, then print or save as PDF.
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setInvoiceOpen(false)} className="rounded-2xl">
                  Close
                </Button>

                <Button onClick={printInvoice} className="rounded-2xl">
                  <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                </Button>
              </div>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-4">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-600">Client</span>
                <select
                  className="w-full rounded-2xl border p-3"
                  value={invoiceFilters.clientName}
                  onChange={(e) => setInvoiceFilters({ ...invoiceFilters, clientName: e.target.value })}
                >
                  {clientNames.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-600">Start Date</span>
                <input
                  type="date"
                  className="w-full rounded-2xl border p-3"
                  value={invoiceFilters.startDate}
                  onChange={(e) => setInvoiceFilters({ ...invoiceFilters, startDate: e.target.value })}
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-600">End Date</span>
                <input
                  type="date"
                  className="w-full rounded-2xl border p-3"
                  value={invoiceFilters.endDate}
                  onChange={(e) => setInvoiceFilters({ ...invoiceFilters, endDate: e.target.value })}
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-600">Invoice #</span>
                <input
                  className="w-full rounded-2xl border p-3"
                  value={invoiceFilters.invoiceNumber}
                  onChange={(e) => setInvoiceFilters({ ...invoiceFilters, invoiceNumber: e.target.value })}
                />
              </label>

              <label className="space-y-1 md:col-span-4">
                <span className="text-sm font-medium text-slate-600">Payment Terms</span>
                <input
                  className="w-full rounded-2xl border p-3"
                  placeholder="Due upon receipt, Net 7, Net 15, Net 30, etc."
                  value={invoiceFilters.paymentTerms}
                  onChange={(e) => setInvoiceFilters({ ...invoiceFilters, paymentTerms: e.target.value })}
                />
              </label>
            </div>

            <InvoicePrintArea
              invoiceNumber={invoiceFilters.invoiceNumber}
              clientName={invoiceFilters.clientName}
              startDate={invoiceFilters.startDate}
              endDate={invoiceFilters.endDate}
              paymentTerms={invoiceFilters.paymentTerms}
              entries={invoiceEntries}
              totals={invoiceTotals}
            />
          </div>
        </div>
      )}

      <div className="hidden print:block">
        <InvoicePrintArea
          invoiceNumber={invoiceFilters.invoiceNumber}
          clientName={invoiceFilters.clientName}
          startDate={invoiceFilters.startDate}
          endDate={invoiceFilters.endDate}
          paymentTerms={invoiceFilters.paymentTerms}
          entries={invoiceEntries}
          totals={invoiceTotals}
        />
      </div>

      {stopDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-2xl font-bold">Finish Time Entry</h2>
            <p className="mb-4 text-slate-600">
              {stopDraft.clientName} • {stopDraft.activity} • {stopDraft.hours.toFixed(2)} hrs
            </p>

            <label className="mb-3 block space-y-1">
              <span className="text-sm font-medium text-slate-600">End Note</span>
              <textarea
                className="h-28 w-full rounded-2xl border p-3"
                placeholder="Example: Phone call with David about implementation next steps."
                value={stopDraft.notes}
                onChange={(e) => setStopDraft({ ...stopDraft, notes: e.target.value })}
              />
            </label>

            <label className="mb-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={stopDraft.billable}
                onChange={(e) => setStopDraft({ ...stopDraft, billable: e.target.checked })}
              />
              Billable
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStopDraft(null)} className="rounded-2xl">
                Cancel
              </Button>
              <Button onClick={saveStopDraft} className="rounded-2xl">
                Save Entry
              </Button>
            </div>
          </div>
        </div>
      )}

      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-2xl font-bold">Manual Time Entry</h2>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-600">Date</span>
                <input
                  type="date"
                  className="w-full rounded-2xl border p-3"
                  value={manual.date}
                  onChange={(e) => setManual({ ...manual, date: e.target.value })}
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-600">Hours</span>
                <input
                  type="number"
                  step="0.1"
                  className="w-full rounded-2xl border p-3"
                  value={manual.hours}
                  onChange={(e) => setManual({ ...manual, hours: e.target.value })}
                />
              </label>
            </div>

            <label className="mt-3 block space-y-1">
              <span className="text-sm font-medium text-slate-600">Activity</span>
              <select
                className="w-full rounded-2xl border p-3"
                value={manual.activity}
                onChange={(e) => {
                  setManual({
                    ...manual,
                    activity: e.target.value,
                    customActivity: e.target.value !== "Custom Activity" ? "" : manual.customActivity,
                  });
                }}
              >
                {ACTIVITY_OPTIONS.map((activity) => (
                  <option key={activity}>{activity}</option>
                ))}
              </select>
            </label>

            {manual.activity === "Custom Activity" && (
              <label className="mt-3 block space-y-1">
                <span className="text-sm font-medium text-slate-600">Custom Activity</span>
                <input
                  className="w-full rounded-2xl border p-3"
                  placeholder="Enter custom activity"
                  value={manual.customActivity}
                  onChange={(e) => setManual({ ...manual, customActivity: e.target.value })}
                />
              </label>
            )}

            <label className="mt-3 block space-y-1">
              <span className="text-sm font-medium text-slate-600">Notes</span>
              <textarea
                className="h-24 w-full rounded-2xl border p-3"
                value={manual.notes}
                onChange={(e) => setManual({ ...manual, notes: e.target.value })}
              />
            </label>

            <label className="my-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={manual.billable}
                onChange={(e) => setManual({ ...manual, billable: e.target.checked })}
              />
              Billable
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManualOpen(false)} className="rounded-2xl">
                Cancel
              </Button>
              <Button onClick={saveManualEntry} className="rounded-2xl">
                Save Manual Entry
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoicePrintArea({
  invoiceNumber,
  clientName,
  startDate,
  endDate,
  paymentTerms,
  entries,
  totals,
}: {
  invoiceNumber: string;
  clientName: string;
  startDate: string;
  endDate: string;
  paymentTerms: string;
  entries: Entry[];
  totals: { hours: number; amount: number };
}) {
  return (
    <div id="invoice-print-area" className="rounded-2xl border bg-white p-6 text-slate-900">
      <div className="mb-8 flex flex-col justify-between gap-6 border-b pb-6 md:flex-row">
        <div className="flex items-start gap-4">
          <img
            src="/anchor-care-logo.png"
            alt="Anchor Care Consulting logo"
            className="h-24 w-24 rounded-xl object-contain"
          />

          <div>
            <h1 className="text-3xl font-bold text-slate-900">Invoice</h1>
            <p className="mt-1 text-lg font-semibold text-slate-800">Anchor Care Consulting</p>
            <p className="text-slate-600">4565 W. Highway 24</p>
            <p className="text-slate-600">Florissant, CO 80816</p>
            <p className="text-slate-600">kathy@anchorcareconsulting.com</p>
          </div>
        </div>

        <div className="text-left md:text-right">
          <p><span className="font-semibold">Invoice #:</span> {invoiceNumber}</p>
          <p><span className="font-semibold">Invoice Date:</span> {todayString()}</p>
          <p><span className="font-semibold">Client:</span> {clientName}</p>
          <p><span className="font-semibold">Terms:</span> {paymentTerms || "Due upon receipt"}</p>

          {(startDate || endDate) && (
            <p>
              <span className="font-semibold">Period:</span>{" "}
              {startDate || "Beginning"} to {endDate || "Today"}
            </p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-slate-600">
              <th className="p-3">Date</th>
              <th className="p-3">Client</th>
              <th className="p-3">Activity</th>
              <th className="p-3 text-right">Hours</th>
              <th className="p-3 text-right">Rate</th>
              <th className="p-3 text-right">Amount</th>
            </tr>
          </thead>

          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  No billable entries match this invoice filter.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <tr className="border-b align-top">
                    <td className="p-3">{entry.date}</td>
                    <td className="p-3">{entry.clientName}</td>
                    <td className="p-3">{entry.activity}</td>
                    <td className="p-3 text-right">{entry.hours.toFixed(2)}</td>
                    <td className="p-3 text-right">{money(entry.rate)}</td>
                    <td className="p-3 text-right">{money(entry.amount)}</td>
                  </tr>

                  {entry.notes && (
                    <tr className="border-b bg-slate-50/50">
                      <td className="p-3 text-slate-500" colSpan={2}>
                        Notes
                      </td>
                      <td className="p-3 text-slate-700" colSpan={4}>
                        {entry.notes}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex justify-end">
        <div className="w-full max-w-sm rounded-2xl bg-slate-50 p-5">
          <div className="flex justify-between border-b py-2">
            <span className="font-medium">Total Hours</span>
            <span>{totals.hours.toFixed(2)}</span>
          </div>

          <div className="flex justify-between pt-4 text-xl font-bold">
            <span>Total Due</span>
            <span>{money(totals.amount)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t pt-4 text-sm text-slate-500">
        <p>Thank you. Payment terms: {paymentTerms || "Due upon receipt"}.</p>
        <p>
          Anchor Care Consulting • 4565 W. Highway 24, Florissant, CO 80816 •
          kathy@anchorcareconsulting.com
        </p>
      </div>
    </div>
  );
}