import { useState, useRef, useEffect } from "react";


import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Upload, Send, FileText, Trash2, BookOpen,
   Loader2, CheckCircle, AlertCircle,
  Database, Zap, Clock, BarChart2, X
} from "lucide-react";

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface Document {
  id: number;
  documentName: string;
  wordCount: number;
  isSmallDoc: boolean;
  uploadDate: string;
  status: string;
  fileSizeKb: number;
}

interface Source {
  documentName: string;
  relevanceScore: number;
  chunkIndex: number;
  pageNumber: number;
  exactQuote: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  approachUsed?: string;
  timestamp: Date;
}

interface HistoryItem {
  id: number;
  question: string;
  answer: string;
  approachUsed: string;
  documentsSearched: string;
  chunksUsed: number;
  searchDate: string;
}

// const BASE = "http://localhost:8080/api/documents";
// const BASE = "http://3.141.165.218:8080/api/documents";

const BASE = process.env.REACT_APP_API_URL || "http://localhost:8080/api/documents";

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [mode, setMode] = useState<"adaptive" | "single" | "multiple">("adaptive");
  const [tab, setTab] = useState<"chat" | "documents" | "history">("chat");
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadDocuments(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadDocuments() {
    try {
      const res = await fetch(`${BASE}/list`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch { }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BASE}/history/recent`);
      const data = await res.json();
      setHistory(data.recentSearches || []);
    } catch { }
    setHistoryLoading(false);
  }

  async function uploadFile(file: File) {
    if (!file.name.endsWith(".pdf")) {
      setUploadError("Only PDF files are allowed!");
      return;
    }
    setUploading(true);
    setUploadError("");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${BASE}/upload-and-index`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.message || "Upload failed!"); }
      else { await loadDocuments(); }
    } catch { setUploadError("Server error — is Spring Boot running?"); }
    setUploading(false);
  }

  async function deleteDoc(name: string) {
    await fetch(`${BASE}/delete/${encodeURIComponent(name)}`, { method: "DELETE" });
    await loadDocuments();
    setSelectedDocs(s => s.filter(d => d !== name));
  }

  async function ask() {
    if (!question.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: question, timestamp: new Date() };
    setMessages(m => [...m, userMsg]);
    setQuestion("");
    setAsking(true);
    try {
      let res: Response;
      const form = new FormData();
      form.append("question", question);
      if (mode === "adaptive") {
        res = await fetch(`${BASE}/adaptive-ask`, { method: "POST", body: form });
      } else if (mode === "single" && selectedDocs.length > 0) {
        form.append("documentName", selectedDocs[0]);
        res = await fetch(`${BASE}/ask-document`, { method: "POST", body: form });
      } else {
        selectedDocs.forEach(d => form.append("documentNames", d));
        res = await fetch(`${BASE}/ask-multiple`, { method: "POST", body: form });
      }
      const data = await res!.json();
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || data.message || "No answer returned.",
        sources: data.sources || [],
        approachUsed: data.approachUsed || mode,
        timestamp: new Date()
      };
      setMessages(m => [...m, aiMsg]);
    } catch {
      setMessages(m => [...m, { id: (Date.now() + 1).toString(), role: "assistant", content: "Error — is Spring Boot running on port 8080?", timestamp: new Date() }]);
    }
    setAsking(false);
  }

  function toggleDoc(name: string) {
    if (mode === "single") {
        // Single mode — only allow 1 document at a time
        setSelectedDocs(s => s.includes(name) ? [] : [name]);
    } else {
        // Multiple mode — allow many documents
        setSelectedDocs(s => s.includes(name) ? s.filter(d => d !== name) : [...s, name]);
    }
}

  function fmt(date: string) {
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div style={styles.root}>
      {/* ── SIDEBAR ── */}
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}><Database size={18} color="#fff" /></div>
          <div>
            <div style={styles.logoName}>DocuMind AI</div>
            <div style={styles.logoSub}>Enterprise RAG</div>
          </div>
        </div>

        {/* Upload Zone */}
        <div
          style={{ ...styles.dropZone, ...(dragOver ? styles.dropZoneActive : {}) }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f); }}
          onClick={() => fileRef.current?.click()}
        >
          {uploading
            ? <><Loader2 size={20} style={styles.spin} color="#6C8EF5" /><span style={styles.dropText}>Indexing...</span></>
            : <><Upload size={20} color="#6C8EF5" /><span style={styles.dropText}>Drop PDF or click</span></>}
        </div>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = ""; }} />
        {uploadError && <div style={styles.uploadError}><AlertCircle size={13} />{uploadError}</div>}

        {/* Documents List */}
        <div style={styles.sidebarLabel}>DOCUMENTS ({documents.length})</div>
        <div style={styles.docList}>
          {documents.length === 0
            ? <div style={styles.emptyDocs}>No documents yet — upload a PDF!</div>
            : documents.map(doc => (
              <div
                key={doc.id}
                style={{ ...styles.docItem, ...(selectedDocs.includes(doc.documentName) ? styles.docItemSelected : {}) }}
                onClick={() => toggleDoc(doc.documentName)}
                onDoubleClick={() => setPreviewDoc(doc.documentName)}
              >
                <FileText size={14} color={selectedDocs.includes(doc.documentName) ? "#6C8EF5" : "#8892A4"} />
                <div style={styles.docInfo}>
                  <div style={styles.docName}>{doc.documentName}</div>
                  <div style={styles.docMeta}>{doc.wordCount.toLocaleString()} words · {doc.fileSizeKb ? `${doc.fileSizeKb} KB` : "—"}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ ...styles.statusBadge, background: doc.status === "INDEXED" ? "#0D3320" : "#2A1A00", color: doc.status === "INDEXED" ? "#4ADE80" : "#FBB040" }}>{doc.status}</span>
                  <button style={styles.deleteBtn} onClick={e => { e.stopPropagation(); deleteDoc(doc.documentName); }}><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
        </div>

        {/* Mode Selector */}
        <div style={styles.sidebarLabel}>SEARCH MODE</div>
        {(["adaptive", "single", "multiple"] as const).map(m => (
          <div key={m} style={{ ...styles.modeBtn, ...(mode === m ? styles.modeBtnActive : {}) }} onClick={() => setMode(m)}>
            {m === "adaptive" ? <Zap size={13} /> : m === "single" ? <BookOpen size={13} /> : <BarChart2 size={13} />}
            <span style={styles.modeBtnText}>{m === "adaptive" ? "Adaptive (Auto)" : m === "single" ? "Single Document" : "Multi Document"}</span>
            {mode === m && <CheckCircle size={13} color="#6C8EF5" style={{ marginLeft: "auto" }} />}
          </div>
        ))}
      </aside>

      {/* ── MAIN ── */}
      {/* i added */}
      <main style={{ ...styles.main, flexDirection: "row" }}>
      {previewDoc && (
        <div style={{ width: "45%", borderRight: "1px solid #1A2235", display: "flex", flexDirection: "column", background: "#0B0E17" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #1A2235" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewDoc}</div>
            <button onClick={() => setPreviewDoc(null)} style={{ background: "none", border: "none", color: "#8892A4", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>✕</button>
          </div>
          <iframe
            src={`http://localhost:8080/api/documents/preview/${encodeURIComponent(previewDoc)}`}
            style={{ flex: 1, border: "none", background: "#0B0E17" }}
            title={previewDoc}
          />
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* i added */}
        {/* Tabs */}
        <div style={styles.tabBar}>
          <button style={{ ...styles.tabBtn, ...(tab === "chat" ? styles.tabBtnActive : {}) }} onClick={() => setTab("chat")}>Chat</button>
          <button style={{ ...styles.tabBtn, ...(tab === "documents" ? styles.tabBtnActive : {}) }} onClick={() => setTab("documents")}>Documents ({documents.length})</button>
          <button style={{ ...styles.tabBtn, ...(tab === "history" ? styles.tabBtnActive : {}) }} onClick={() => { setTab("history"); loadHistory(); }}>History</button>
        </div>

        {/* ── CHAT TAB ── */}
        {tab === "chat" && (
          <div style={styles.chatArea}>
            {/* Messages */}
            <div style={styles.messages}>
              {messages.length === 0 && (
                <div style={styles.welcome}>
                  <div style={styles.welcomeIcon}><Database size={32} color="#6C8EF5" /></div>
                  <div style={styles.welcomeTitle}>DocuMind AI</div>
                  <div style={styles.welcomeSub}>Upload PDFs and ask questions in plain English. Every answer is cited from your documents.</div>
                  <div style={styles.welcomeHints}>
                    {["What is Java?", "Compare Python and Ruby", "What makes Scala unique?"].map(hint => (
                      <button key={hint} style={styles.hintBtn} onClick={() => setQuestion(hint)}>{hint}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} style={{ ...styles.msgRow, ...(msg.role === "user" ? styles.msgRowUser : {}) }}>
                  {msg.role === "assistant" && <div style={styles.aiAvatar}><Database size={14} color="#6C8EF5" /></div>}
                  <div style={{ ...styles.bubble, ...(msg.role === "user" ? styles.bubbleUser : styles.bubbleAI) }}>
                    <div style={styles.bubbleText} className="bubble-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>


                    {msg.sources && msg.sources.length > 0 && (
                      <div style={styles.sources}>
                        <div style={styles.sourcesTitle}><BookOpen size={11} /> Sources</div>
                        {msg.sources.map((s, i) => (
                          <div key={i} style={styles.source}>
                            <div style={styles.sourceHeader}>
                              <span style={styles.sourceDoc}>{s.documentName}</span>
                              <span style={styles.sourcePage}>p.{s.pageNumber}</span>
                              <span style={styles.sourceScore}>{(s.relevanceScore * 100).toFixed(0)}% match</span>
                            </div>
                            {s.exactQuote && <div style={styles.sourceQuote}>"{s.exactQuote}"</div>}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.approachUsed && (
                      <div style={styles.approach}>
                        <Zap size={10} color="#6C8EF5" />
                        <span>{msg.approachUsed}</span>
                        <Clock size={10} color="#4A5568" />
                        <span>{msg.timestamp.toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && <div style={styles.userAvatar}>R</div>}
                </div>
              ))}
              {asking && (
                <div style={styles.msgRow}>
                  <div style={styles.aiAvatar}><Database size={14} color="#6C8EF5" /></div>
                  <div style={styles.bubbleAI}>
                    <div style={styles.thinking}><Loader2 size={14} style={styles.spin} /><span>Thinking...</span></div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={styles.inputArea}>
              {(mode === "single" || mode === "multiple") && selectedDocs.length > 0 && (
                <div style={styles.selectedDocs}>
                  {selectedDocs.map(d => (
                    <span key={d} style={styles.selectedDocTag}>
                      {d} <X size={10} style={{ cursor: "pointer" }} onClick={() => toggleDoc(d)} />
                    </span>
                  ))}
                </div>
              )}
              <div style={styles.inputRow}>
                <textarea
                  style={styles.textarea}
                  placeholder={documents.length === 0 ? "Upload a PDF first..." : "Ask a question about your documents..."}
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
                  rows={2}
                  disabled={documents.length === 0 || asking}
                />
                <button style={{ ...styles.sendBtn, ...((!question.trim() || asking || documents.length === 0) ? styles.sendBtnDisabled : {}) }} onClick={ask} disabled={!question.trim() || asking || documents.length === 0}>
                  {asking ? <Loader2 size={18} style={styles.spin} /> : <Send size={18} />}
                </button>
              </div>
              <div style={styles.inputHint}>Enter to send · Shift+Enter for new line · Mode: <strong>{mode}</strong></div>
            </div>
          </div>
        )}

        {/* ── DOCUMENTS TAB ── */}
        {tab === "documents" && (
          <div style={styles.docsTab}>
            <div style={styles.docsGrid}>
              {documents.length === 0
                ? <div style={styles.emptyState}><Database size={40} color="#2D3748" /><div>No documents uploaded yet</div><div style={{ fontSize: 13, color: "#4A5568" }}>Drop a PDF in the sidebar to get started</div></div>
                : documents.map(doc => (
                  <div key={doc.id} style={styles.docCard}>
                    <div style={styles.docCardHeader}>
                      <FileText size={20} color="#6C8EF5" />
                      <span style={{ ...styles.statusBadge, background: doc.status === "INDEXED" ? "#0D3320" : "#2A1A00", color: doc.status === "INDEXED" ? "#4ADE80" : "#FBB040" }}>{doc.status}</span>
                    </div>
                    <div style={styles.docCardName}>{doc.documentName}</div>
                    <div style={styles.docCardStats}>
                      <div style={styles.stat}><span style={styles.statLabel}>Words</span><span style={styles.statValue}>{doc.wordCount.toLocaleString()}</span></div>
                      <div style={styles.stat}><span style={styles.statLabel}>Size</span><span style={styles.statValue}>{doc.fileSizeKb ? `${doc.fileSizeKb} KB` : "—"}</span></div>
                      <div style={styles.stat}><span style={styles.statLabel}>Type</span><span style={styles.statValue}>{doc.isSmallDoc ? "Small" : "Large"}</span></div>
                      <div style={styles.stat}><span style={styles.statLabel}>Uploaded</span><span style={styles.statValue}>{fmt(doc.uploadDate)}</span></div>
                    </div>
                    <button style={styles.deleteCardBtn} onClick={() => deleteDoc(doc.documentName)}><Trash2 size={13} /> Delete</button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div style={styles.docsTab}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0" }}>Recent Searches ({history.length})</div>
              <button
                style={{ background: "#1A0A0A", border: "1px solid #3D1515", borderRadius: 7, color: "#FC8181", cursor: "pointer", fontSize: 12, padding: "6px 12px", display: "flex", alignItems: "center", gap: 5 }}
                onClick={async () => {
                  await fetch(`${BASE}/history/clear`, { method: "DELETE" });
                  setHistory([]);
                }}>
                🗑 Clear History
              </button>
            </div>
            {historyLoading
              ? <div style={{ color: "#4A5568", textAlign: "center", padding: 40 }}>Loading history...</div>
              : history.length === 0
              ? <div style={{ color: "#4A5568", textAlign: "center", padding: 40 }}>
              No search history yet — ask some questions first!</div>
              : history.map((item, i) => (
                // <div key={item.id} style={{ background: "#0F1623", 
                // border: "1px solid #1A2235", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div key={item.id} style={{ background: "#0F1623", border: "1px solid #1A2235", borderRadius: 12, padding: 16, marginBottom: 12, position: "relative" }}
                  onMouseEnter={e => { const btn = e.currentTarget.querySelector('.del-btn') as HTMLElement; if(btn) btn.style.display = 'flex'; }}
                  onMouseLeave={e => { const btn = e.currentTarget.querySelector('.del-btn') as HTMLElement; if(btn) btn.style.display = 'none'; }}
                >
                  <button className="del-btn" style={{ display: "none", position: "absolute", top: 10, right: 10, background: "#1A0A0A", border: "1px solid #3D1515", borderRadius: 6, color: "#FC8181", cursor: "pointer", fontSize: 11, padding: "4px 8px", alignItems: "center", gap: 4 }}
                    onClick={async () => {
                      await fetch(`${BASE}/history/${item.id}`, { method: "DELETE" });
                      setHistory(h => h.filter(x => x.id !== item.id));
                    }}>
                    🗑 Delete
                  </button>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", flex: 1 }}>Q: {item.question}</div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", 
                        borderRadius: 4, background: "#131C2E", color: "#6C8EF5", 
                        border: "1px solid #2D3A55" }}>{item.approachUsed}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, 
                        padding: "2px 8px", borderRadius: 4, background: "#0D3320", 
                        color: "#4ADE80" }}>{item.chunksUsed} chunks</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#8892A4", 
                    marginBottom: 8, lineHeight: 1.5 }}>{item.answer?.slice(0, 200)}...</div>
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#4A5568" }}>
                    <span>📄 {item.documentsSearched}</span>
                    <span>🕐 {new Date(item.searchDate).toLocaleString()}</span>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
      </main>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: 
  { display: "flex", 
    height: "100vh", 
    background: "#0B0E17", 
    color: "#E2E8F0", 
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif", 
    overflow: "hidden" 
  },
  sidebar: 
  { 
    width: 280, 
    minWidth: 280, 
    background: "#0F1623", 
    borderRight: "1px solid #1A2235", 
    display: "flex", flexDirection: "column", 
    padding: "20px 14px", 
    gap: 8, 
    overflowY: "auto" 
  },
  logo: 
  { display: "flex", 
    alignItems: "center", 
    gap: 10, 
    marginBottom: 16 
  },
  logoIcon: 
  { width: 34, 
    height: 34, 
    background: "linear-gradient(135deg,#6C8EF5,#8B5CF6)", 
    borderRadius: 8, 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center" 
  },
  logoName: { 
    fontSize: 15, 
    fontWeight: 700, 
    color: "#E2E8F0", 
    letterSpacing: "-0.3px" 
  },
  logoSub: 
  { 
    fontSize: 10, 
    color: "#4A5568", 
    textTransform: "uppercase", 
    letterSpacing: 1 
  },
  dropZone: 
  { border: "1.5px dashed #2D3748", 
    borderRadius: 10, 
    padding: "14px 10px", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 8, cursor: "pointer", 
    transition: "all 0.2s", 
    marginBottom: 4 
  },
  dropZoneActive: { 
    borderColor: "#6C8EF5", 
    background: "#131C2E" 
  },
  dropText: 
  { fontSize: 13, 
    color: "#8892A4" 
  },
  uploadError: 
  { display: "flex", 
    alignItems: "center", 
    gap: 5, 
    fontSize: 11, 
    color: "#FC8181", 
    background: "#1A0A0A", 
    borderRadius: 6, 
    padding: "6px 10px" 
  },
  sidebarLabel: { 
    fontSize: 10, 
    color: "#4A5568", 
    letterSpacing: 1.2, 
    textTransform: "uppercase", 
    marginTop: 12, 
    marginBottom: 4, 
    paddingLeft: 4 
  },
  docList: { 
    display: "flex", 
    flexDirection: "column", 
    gap: 4, maxHeight: 280, 
    overflowY: "auto" 
  },
  emptyDocs: 
  { fontSize: 12, 
    color: "#4A5568", 
    textAlign: "center", 
    padding: "16px 0" 
  },
  docItem: 
  { display: "flex", 
    alignItems: "center", 
    gap: 8, 
    padding: "8px 10px", 
    borderRadius: 8, 
    cursor: "pointer", 
    border: "1px solid transparent", 
    transition: "all 0.15s" 
  },
  docItemSelected: { 
    background: "#131C2E", 
    border: "1px solid #2D3A55" 
  },
  docInfo: { flex: 1, minWidth: 0 },

  docName: { 
    fontSize: 12, 
    fontWeight: 600, 
    color: "#CBD5E0", 
    overflow: "hidden", 
    textOverflow: "ellipsis", 
    whiteSpace: "nowrap" 
  },
  docMeta: { 
    fontSize: 10, 
    color: "#4A5568", 
    marginTop: 1 
  },
  statusBadge: { 
    fontSize: 9, 
    fontWeight: 700, 
    padding: "2px 6px", 
    borderRadius: 4, 
    letterSpacing: 0.5 
  },
  deleteBtn: { 
    background: "none", 
    border: "none", 
    cursor: "pointer", 
    color: "#4A5568", 
    padding: 2, 
    display: "flex", 
    alignItems: "center" 
  },
  modeBtn: { 
    display: "flex", 
    alignItems: "center", 
    gap: 8, 
    padding: "8px 10px", 
    borderRadius: 8, 
    cursor: "pointer", 
    color: "#8892A4", 
    fontSize: 12, 
    transition: "all 0.15s" 
  },
  modeBtnActive: { 
    background: "#131C2E", 
    color: "#E2E8F0", 
    border: "1px solid #2D3A55" 
  },
  modeBtnText: { flex: 1 },

  main: { 
    flex: 1, 
    display: "flex", 
    flexDirection: "column", 
    overflow: "hidden" 
  },
  tabBar: { 
    display: "flex", 
    gap: 0, 
    borderBottom: "1px solid #1A2235", 
    padding: "0 24px" 
  },
  tabBtn: { 
    background: "none", 
    border: "none", 
    borderBottom: "2px solid transparent", 
    color: "#4A5568", 
    cursor: "pointer", 
    padding: "14px 16px", 
    fontSize: 13, 
    fontWeight: 500, 
    transition: "all 0.15s" 
  },
  tabBtnActive: { 
    color: "#6C8EF5", 
    borderBottom: "2px solid #6C8EF5" 
  },
  chatArea: { 
    flex: 1, 
    display: "flex", 
    flexDirection: "column", 
    overflow: "hidden" 
  },
  messages: { 
    flex: 1, 
    overflowY: "auto", 
    padding: "24px", 
    display: "flex", 
    flexDirection: "column", 
    gap: 16 },
  welcome: { 
    display: "flex", 
    flexDirection: "column", 
    alignItems: "center", 
    justifyContent: "center", 
    flex: 1, gap: 12, 
    textAlign: "center", 
    padding: "60px 24px" 
  },
  welcomeIcon: { 
    width: 64, 
    height: 64, 
    background: "#131C2E", 
    borderRadius: 16, 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    marginBottom: 8 
  },
  welcomeTitle: { 
    fontSize: 24, 
    fontWeight: 700, 
    color: "#E2E8F0", 
    letterSpacing: "-0.5px" 
  },
  welcomeSub: { 
    fontSize: 14, 
    color: "#8892A4", 
    maxWidth: 400, 
    lineHeight: 1.6 
  },
  welcomeHints: { 
    display: "flex", 
    gap: 8, flexWrap: "wrap", 
    justifyContent: "center", 
    marginTop: 8 
  },
  hintBtn: { 
    background: "#131C2E", 
    border: "1px solid #2D3748", 
    borderRadius: 20, 
    color: "#8892A4", 
    cursor: "pointer", 
    fontSize: 12, 
    padding: "7px 14px", 
    transition: "all 0.15s" 
  },
  msgRow: { 
    display: "flex", 
    gap: 10, 
    alignItems: "flex-start" 
  },
  msgRowUser: { flexDirection: "row-reverse" },

  aiAvatar: { 
    width: 30, 
    height: 30, 
    background: "#131C2E", 
    borderRadius: 8, display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    flexShrink: 0, 
    border: "1px solid #2D3748" 
  },
  userAvatar: { 
    width: 30, 
    height: 30, 
    background: "linear-gradient(135deg,#6C8EF5,#8B5CF6)", 
    borderRadius: 8, 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    flexShrink: 0, 
    fontSize: 13, 
    fontWeight: 700, 
    color: "#fff" 
  },
  bubble: { 
    maxWidth: "72%", 
    borderRadius: 12,
    padding: "12px 16px", 
    fontSize: 14, 
    lineHeight: 1.6 
  },
  bubbleUser: { 
    background: "linear-gradient(135deg,#6C8EF5,#8B5CF6)", 
    color: "#fff", 
    borderTopRightRadius: 2 
  },
  bubbleAI: { 
    background: "#131C2E", 
    border: "1px solid #1A2235", 
    color: "#CBD5E0", 
    borderTopLeftRadius: 2 
  },
  bubbleText: { 
    whiteSpace: "pre-wrap" 
  },

  sources: { 
    marginTop: 12, 
    borderTop: "1px solid #1A2235", 
    paddingTop: 10, display: "flex", 
    flexDirection: "column", 
    gap: 6 
  },
  sourcesTitle: { 
    display: "flex", 
    alignItems: "center", 
    gap: 5, 
    fontSize: 10, 
    color: "#6C8EF5", 
    textTransform: "uppercase", 
    letterSpacing: 1, 
    fontWeight: 700, 
    marginBottom: 4 
  },
  source: { 
    background: "#0B0E17", 
    borderRadius: 8, 
    padding: "8px 10px", 
    border: "1px solid #1A2235" 
  },
  sourceHeader: { 
    display: "flex", 
    gap: 8, 
    alignItems: "center", 
    marginBottom: 4 
  },
  sourceDoc: { 
    fontSize: 11, 
    fontWeight: 700, 
    color: "#E2E8F0", 
    flex: 1, 
    overflow: "hidden", 
    textOverflow: "ellipsis", 
    whiteSpace: "nowrap" },
  sourcePage: { fontSize: 10, color: "#4A5568", background: "#1A2235", padding: "1px 5px", borderRadius: 4 },

  sourceScore: { fontSize: 10, color: "#6C8EF5", fontWeight: 600 },

  sourceQuote: { fontSize: 11, color: "#8892A4", lineHeight: 1.5, fontStyle: "italic" },

  approach: { display: "flex", alignItems: "center", gap: 5, marginTop: 8, fontSize: 10, color: "#4A5568" },

  thinking: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#8892A4" },

  spin: { animation: "spin 1s linear infinite" },

  inputArea: { padding: "16px 24px 20px", borderTop: "1px solid #1A2235" },

  selectedDocs: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 },

  selectedDocTag: 
  { display: "flex", 
    alignItems: "center", 
    gap: 4, 
    background: "#131C2E", 
    border: "1px solid #2D3A55", 
    borderRadius: 12, 
    padding: "3px 8px", 
    fontSize: 11, color: "#6C8EF5" 
  },
  inputRow: { 
    display: "flex", 
    gap: 10, 
    alignItems: "flex-end" 
  },

  textarea: 
  { flex: 1, 
    background: "#131C2E", 
    border: "1px solid #2D3748", 
    borderRadius: 10, 
    color: "#E2E8F0", 
    fontSize: 14, 
    padding: "12px 14px", 
    resize: "none", 
    outline: "none", 
    lineHeight: 1.5, 
    fontFamily: "inherit" 
  },
  sendBtn: { 
    width: 44, 
    height: 44, 
    background: "linear-gradient(135deg,#6C8EF5,#8B5CF6)", 
    border: "none", 
    borderRadius: 10, 
    cursor: "pointer", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    color: "#fff", 
    flexShrink: 0 
  },
  sendBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },

  inputHint: { fontSize: 11, color: "#4A5568", marginTop: 6 },

  docsTab: { flex: 1, overflowY: "auto", padding: 24 },

  docsGrid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", 
    gap: 16 
  },
  emptyState: 
  { gridColumn: "1/-1", 
    display: "flex", 
    flexDirection: "column", 
    alignItems: "center", 
    gap: 10, 
    padding: "80px 0", 
    color: "#4A5568" 
  },
  docCard: { 
    background: "#0F1623", 
    border: "1px solid #1A2235", 
    borderRadius: 12, 
    padding: 16, 
    display: "flex", 
    flexDirection: "column", 
    gap: 10 
  },
  docCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },

  docCardName: { fontSize: 13, fontWeight: 700, color: "#E2E8F0", wordBreak: "break-all" },

  docCardStats: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },

  stat: { display: "flex", flexDirection: "column", gap: 2 },

  statLabel: { fontSize: 10, color: "#4A5568", textTransform: "uppercase", letterSpacing: 0.5 },

  statValue: { fontSize: 12, fontWeight: 600, color: "#CBD5E0" },

  deleteCardBtn: { 
    display: "flex", 
    alignItems: "center", 
    gap: 5, background: "#1A0A0A", 
    border: "1px solid #3D1515", 
    borderRadius: 7, color: "#FC8181", 
    cursor: "pointer", 
    fontSize: 12, 
    padding: "6px 10px", 
    marginTop: 4, 
    width: "100%", 
    justifyContent: "center" 
  },

};
