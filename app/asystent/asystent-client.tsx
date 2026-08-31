"use client";

import React, { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Send,
  Plus,
  Trash2,
  Loader2,
  User,
  Activity,
  ChevronRight,
  Sparkles,
  Bot,
  BrainCircuit,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMarkdown } from "@/components/ai/chat-markdown";

interface ConversationInfo {
  id: string;
  title: string;
  agentType: "DOCTOR" | "TRAINER";
  createdAt: string;
  updatedAt: string;
  lastMessage: {
    content: string;
    createdAt: string;
    role: string;
  } | null;
}

interface AsystentClientProps {
  hasGeminiKey: boolean;
}

function getMessageText(message: any): string {
  if (typeof message.content === "string" && message.content) {
    return message.content;
  }
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((part: any) => {
        if (part.type === "text") return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function AsystentClient({ hasGeminiKey }: AsystentClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialAgent = searchParams.get("agent") === "trainer" ? "TRAINER" : "DOCTOR";

  const [selectedAgent, setSelectedAgent] = useState<"DOCTOR" | "TRAINER">(initialAgent);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationInfo[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [input, setInput] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init);
    const headerId = response.headers.get("x-conversation-id");
    if (headerId && headerId !== activeConversationId) {
      setActiveConversationId(headerId);
      setTimeout(() => {
        fetchConversations();
      }, 50);
    }
    return response;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setInput(e.target.value);
  };

  // Vercel AI SDK useChat Hook
  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      body: {
        agentType: selectedAgent,
        conversationId: activeConversationId || undefined,
      },
      fetch: customFetch,
    }),
    onFinish: () => {
      fetchConversations();
    }
  }) as any;

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading || !hasGeminiKey) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  // Fetch all conversations of the user
  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/ai/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Błąd ładowania historii konwersacji:", err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Sync selectedAgent if query param changes
  useEffect(() => {
    const agentParam = searchParams.get("agent");
    if (agentParam === "trainer") {
      setSelectedAgent("TRAINER");
      if (!activeConversationId) setMessages([]);
    } else if (agentParam === "doctor") {
      setSelectedAgent("DOCTOR");
      if (!activeConversationId) setMessages([]);
    }
  }, [searchParams]);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto resize textarea input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const loadConversation = async (id: string) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/ai/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveConversationId(data.id);
        setSelectedAgent(data.agentType);
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Błąd ładowania szczegółów konwersacji:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Czy na pewno chcesz usunąć tę rozmowę z historii?")) return;

    try {
      const res = await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (activeConversationId === id) {
          startNewChat(selectedAgent);
        }
        fetchConversations();
      }
    } catch (err) {
      console.error("Błąd podczas usuwania konwersacji:", err);
    }
  };

  const startNewChat = (agent: "DOCTOR" | "TRAINER") => {
    setActiveConversationId(null);
    setSelectedAgent(agent);
    setMessages([]);
    setInput("");
    router.replace(`/asystent?agent=${agent.toLowerCase()}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading && hasGeminiKey) {
        handleSubmit();
      }
    }
  };

  const selectSuggestedQuestion = (question: string) => {
    setInput(question);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const doctorSuggestedQuestions = [
    "🩺 Podsumuj moje wyniki zdrowotne z ostatniego tygodnia.",
    "🔬 Jakie badania profilaktyczne powinienem zrobić w moim wieku?",
    "💊 Czy moje leki i suplementy nie wchodzą w negatywne interakcje?",
    "💤 Przeanalizuj moje tętno spoczynkowe i jakość snu z ostatnich dni."
  ];

  const trainerSuggestedQuestions = [
    "🏃 Przeanalizuj mój ostatni tydzień treningowy biegowy.",
    "💪 Sprawdź moje rekordy siłowe i postępy w ćwiczeniach.",
    "⏱️ Na jaki czas na dystansie 10km mogę liczyć z moją aktualną formą?",
    "📉 Jak wygląda moje obciążenie treningowe (CTL, ATL, TSB)? Czy grozi mi przetrenowanie?"
  ];

  // Group conversations by agent type
  const doctorConversations = conversations.filter(c => c.agentType === "DOCTOR");
  const trainerConversations = conversations.filter(c => c.agentType === "TRAINER");

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#0d0e0c] text-white overflow-hidden">
      
      {/* 1. Sidebar Historii Czatów */}
      <aside className="w-80 border-r border-[#1a1c18] bg-[#090a08] flex flex-col shrink-0 select-none">
        
        {/* Przycisk Nowy Czat */}
        <div className="p-4 border-b border-[#1a1c18] space-y-2">
          <button
            onClick={() => startNewChat("DOCTOR")}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a1c18] hover:bg-[#252822] text-[#bce663] border border-[#2a2d26] rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            🩺 Nowy Lek(AI)rz POZ
          </button>
          <button
            onClick={() => startNewChat("TRAINER")}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a1c18] hover:bg-[#252822] text-[#bce663] border border-[#2a2d26] rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            🏋️ Nowy Trener Person(AI)lny
          </button>
        </div>

        {/* Lista rozmów */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          
          {/* Sekcja: Lekarz POZ */}
          <div>
            <div className="flex items-center gap-1.5 px-3 mb-2 text-[10px] font-bold text-stone-500 uppercase tracking-widest">
              <span>🩺 Lek(AI)rz POZ</span>
              <span className="text-stone-600 font-mono">({doctorConversations.length})</span>
            </div>
            {doctorConversations.length === 0 ? (
              <p className="text-xs text-stone-600 px-3 py-1 italic">Brak historii...</p>
            ) : (
              <div className="space-y-0.5">
                {doctorConversations.map(c => (
                  <div
                    key={c.id}
                    onClick={() => loadConversation(c.id)}
                    className={cn(
                      "group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors relative",
                      activeConversationId === c.id
                        ? "bg-[#1a1c18] text-[#bce663]"
                        : "text-stone-400 hover:bg-[#1a1c18]/40 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-6">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{c.title}</span>
                    </div>
                    <button
                      onClick={(e) => deleteConversation(c.id, e)}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 rounded transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sekcja: Trener Personalny */}
          <div>
            <div className="flex items-center gap-1.5 px-3 mb-2 text-[10px] font-bold text-stone-500 uppercase tracking-widest">
              <span>🏋️ Trener Person(AI)lny</span>
              <span className="text-stone-600 font-mono">({trainerConversations.length})</span>
            </div>
            {trainerConversations.length === 0 ? (
              <p className="text-xs text-stone-600 px-3 py-1 italic">Brak historii...</p>
            ) : (
              <div className="space-y-0.5">
                {trainerConversations.map(c => (
                  <div
                    key={c.id}
                    onClick={() => loadConversation(c.id)}
                    className={cn(
                      "group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors relative",
                      activeConversationId === c.id
                        ? "bg-[#1a1c18] text-[#bce663]"
                        : "text-stone-400 hover:bg-[#1a1c18]/40 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-6">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{c.title}</span>
                    </div>
                    <button
                      onClick={(e) => deleteConversation(c.id, e)}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 rounded transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </aside>

      {/* 2. Obszar Czatów i Witania */}
      <main className="flex-1 flex flex-col bg-[#0d0e0c] relative h-full">
        
        {/* Komunikat o braku klucza */}
        {!hasGeminiKey && (
          <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs flex items-center gap-2 select-none">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong>Klucz Gemini API nie jest skonfigurowany!</strong> Przejdź do <a href="/settings" className="underline font-semibold hover:text-amber-200">Ustawień</a> i wprowadź swój klucz Gemini, aby korzystać z asystentów AI.
            </span>
          </div>
        )}

        {/* Nagłówek aktywnego czatu */}
        <header className="px-6 py-4 border-b border-[#1a1c18] bg-[#0c0d0b] flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1a1c18] border border-[#2a2d26] flex items-center justify-center text-lg shadow-inner">
              {selectedAgent === "DOCTOR" ? "🩺" : "🏋️"}
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide">
                {selectedAgent === "DOCTOR" ? "Lek(AI)rz POZ" : "Trener Person(AI)lny"}
              </h1>
              <p className="text-[10px] text-stone-500 font-medium">
                {selectedAgent === "DOCTOR"
                  ? "Asystent medyczny i profilaktyczny zdrowia"
                  : "Asystent treningowy, biegowy i siłowy"}
              </p>
            </div>
          </div>
          {activeConversationId && (
            <button
              onClick={() => startNewChat(selectedAgent)}
              className="text-xs text-stone-400 hover:text-[#bce663] px-3 py-1.5 border border-[#1a1c18] hover:border-[#2a2d26] bg-[#10120f] rounded-lg transition-colors"
            >
              Rozpocznij nowy wątek
            </button>
          )}
        </header>

        {/* Zawartość: Czat lub Ekran Powitalny */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {loadingHistory ? (
            <div className="h-full flex items-center justify-center text-stone-500 gap-2 text-sm select-none">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Ładowanie wątku...</span>
            </div>
          ) : messages.length === 0 ? (
            
            // Ekran powitalny (Welcome Screen)
            <div className="max-w-3xl mx-auto space-y-8 py-8 select-none">
              
              {/* Sekcja nagłówkowa */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#1a1c18] border border-[#2a2d26] rounded-full text-xs text-[#bce663] font-semibold">
                  <BrainCircuit className="h-3 w-3 animate-pulse" />
                  <span>Sztuczna Inteligencja healthOS</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Witaj w Centrum Asystentów AI</h2>
                <p className="text-sm text-stone-400 max-w-lg mx-auto">
                  Wybierz wyspecjalizowanego agenta, który posiada pełny wgląd w Twoje lokalne dane i pomoże Ci zinterpretować wyniki lub zaplanować sportową formę.
                </p>
              </div>

              {/* Wybór Agenta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Karta: Lekarz */}
                <div
                  onClick={() => setSelectedAgent("DOCTOR")}
                  className={cn(
                    "p-5 rounded-2xl border cursor-pointer transition-all duration-200 text-left relative overflow-hidden",
                    selectedAgent === "DOCTOR"
                      ? "bg-[#141512] border-[#bce663] shadow-[0_0_12px_rgba(188,230,99,0.08)]"
                      : "bg-[#10110e] border-[#1a1c18] hover:border-[#2a2d26]"
                  )}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1e201b] border border-[#2a2d26] flex items-center justify-center text-lg mb-3">
                    🩺
                  </div>
                  <h3 className="text-sm font-bold mb-1">Lek(AI)rz POZ</h3>
                  <p className="text-xs text-stone-400 mb-3">
                    Analizuje badania laboratoryjne krwi, identyfikuje trendy i anomalie, sprawdza interakcje suplementów i leków oraz podsumowuje stan zdrowia.
                  </p>
                  <span className="text-[10px] font-semibold text-[#bce663] flex items-center gap-1">
                    Uruchom asystenta medycznego <ChevronRight className="h-3 w-3" />
                  </span>
                </div>

                {/* Karta: Trener */}
                <div
                  onClick={() => setSelectedAgent("TRAINER")}
                  className={cn(
                    "p-5 rounded-2xl border cursor-pointer transition-all duration-200 text-left relative overflow-hidden",
                    selectedAgent === "TRAINER"
                      ? "bg-[#141512] border-[#bce663] shadow-[0_0_12px_rgba(188,230,99,0.08)]"
                      : "bg-[#10110e] border-[#1a1c18] hover:border-[#2a2d26]"
                  )}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1e201b] border border-[#2a2d26] flex items-center justify-center text-lg mb-3">
                    🏋️
                  </div>
                  <h3 className="text-sm font-bold mb-1">Trener Person(AI)lny</h3>
                  <p className="text-xs text-stone-400 mb-3">
                    Interpretuje obciążenie treningowe (CTL/ATL/TSB), przewiduje wyniki wyścigów z VO2max/VDOT, ocenia regenerację oraz układa i koryguje plany.
                  </p>
                  <span className="text-[10px] font-semibold text-[#bce663] flex items-center gap-1">
                    Uruchom asystenta sportowego <ChevronRight className="h-3 w-3" />
                  </span>
                </div>

              </div>

              {/* Sugerowane Pytania */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 text-center">
                  Sugerowane pytania na start
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {(selectedAgent === "DOCTOR" ? doctorSuggestedQuestions : trainerSuggestedQuestions).map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectSuggestedQuestion(q)}
                      className="px-4 py-3 text-left text-xs bg-[#10120f] hover:bg-[#1a1c18] border border-[#1a1c18] hover:border-[#2a2d26] rounded-xl transition-all duration-200 text-stone-300 hover:text-white"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            
            // Wiadomości w czacie
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.map((msg: any) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-4 p-4 rounded-2xl border",
                      isUser
                        ? "bg-[#1a1c18] border-[#252822] ml-12"
                        : "bg-[#10120f] border-[#1a1c18] mr-12"
                    )}
                  >
                    {/* Avatar */}
                    <div className="shrink-0">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                        isUser 
                          ? "bg-[#bce663] text-black" 
                          : "bg-[#1e201b] border border-[#2a2d26] text-[#bce663]"
                      )}>
                        {isUser ? <User className="h-4 w-4" /> : (selectedAgent === "DOCTOR" ? "🩺" : "🏋️")}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-500">
                          {isUser ? "Ty" : (selectedAgent === "DOCTOR" ? "Lek(AI)rz POZ" : "Trener Person(AI)lny")}
                        </span>
                        <span className="text-[10px] text-stone-600 font-mono">
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      
                      <div className="text-stone-200">
                        {isUser ? (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{getMessageText(msg)}</p>
                        ) : (
                          <ChatMarkdown content={getMessageText(msg)} />
                        )}
                      </div>

                      {/* Narzędzia (Function Calling Status) */}
                      {msg.toolInvocations && msg.toolInvocations.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {msg.toolInvocations.map((toolInv: any) => {
                            const namePl = toolInv.toolName;
                            const isFinished = toolInv.state === "result";
                            return (
                              <div
                                key={toolInv.toolCallId}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#151713] border border-[#23271f] text-[10px] font-mono text-stone-400"
                              >
                                {isFinished ? (
                                  <span className="text-green-500 font-bold">✓</span>
                                ) : (
                                  <Loader2 className="h-3 w-3 animate-spin text-[#bce663]" />
                                )}
                                <span>Odpytano bazę: {namePl}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Spinner ładowania w trakcie streamowania */}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-4 p-4 bg-[#10120f] border border-[#1a1c18] rounded-2xl mr-12">
                  <div className="shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-[#1e201b] border border-[#2a2d26] flex items-center justify-center text-[#bce663]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <span className="text-xs font-semibold text-stone-500">Asystent</span>
                    <p className="text-xs text-stone-400 italic">Generowanie odpowiedzi...</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 3. Panel wprowadzania tekstu (Input Area) */}
        <footer className="p-4 bg-[#0a0a09] border-t border-[#1a1c18]">
          <div className="max-w-4xl mx-auto">
            <form
              onSubmit={handleSubmit}
              className="relative bg-[#10120f] border border-[#1a1c18] focus-within:border-[#bce663]/40 rounded-xl transition-colors overflow-hidden"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                placeholder={
                  selectedAgent === "DOCTOR"
                    ? "Zapytaj Lek(AI)rza POZ o badania, leki lub stan zdrowia..."
                    : "Zapytaj Trenera o obciążenia CTL/TSB, bieganie lub trening siłowy..."
                }
                rows={1}
                disabled={!hasGeminiKey}
                className="w-full pl-4 pr-14 py-3 bg-transparent text-sm text-stone-200 placeholder-stone-600 focus:outline-none resize-none min-h-[44px] max-h-[180px] leading-relaxed block"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || !hasGeminiKey}
                className={cn(
                  "absolute right-2 bottom-1.5 p-2 rounded-lg transition-colors shrink-0",
                  input.trim() && !isLoading && hasGeminiKey
                    ? "bg-[#bce663] text-black hover:bg-[#aadb50]"
                    : "bg-[#1a1c18] text-stone-600 cursor-not-allowed border border-[#22241f]"
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
            <div className="flex justify-between items-center px-1 mt-2 text-[10px] text-stone-600 select-none">
              <span>Shift+Enter = nowa linia · Enter = wyślij</span>
              <span>Lokalni Agenci AI v0.7 (read-only queries)</span>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}
