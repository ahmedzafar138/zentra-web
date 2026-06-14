import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/hooks/useAuth";
import { supabase, hasSupabaseConfig } from "@/integrations/supabase/client";
import { askZentra } from "@/lib/api";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/zentra-ai")({
  head: () => ({ meta: [{ title: "Zentra AI — Coach" }] }),
  component: () => (
    <Protected>
      <ZentraAIPage />
    </Protected>
  ),
});

const aiChatHistoryKey = (userId?: string | null) => `zentra:ai-chat-history:${userId ?? "guest"}`;

function readLocalAiMessages(userId?: string | null): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(aiChatHistoryKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((message: { id?: string; role: "user" | "assistant"; content: string; timestamp: string | Date }) => ({
          ...message,
          timestamp: new Date(message.timestamp),
        }))
      : [];
  } catch {
    return [];
  }
}

function writeLocalAiMessages(userId: string | null | undefined, messages: Message[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(aiChatHistoryKey(userId), JSON.stringify(messages.slice(-80)));
}

const suggestions = [
  "Suggest some good exercises for Biceps",
  "I want to train shoulders & biceps, suggest 6 exercises",
  "How much creatine should I take?",
];

function ZentraAIPage() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const persistLocalMessage = (message: Message) => {
    setMessages((previous) => {
      const next = [...previous, message];
      writeLocalAiMessages(user?.id, next);
      return next;
    });
  };

  const ensureConversation = async (title: string) => {
    if (conversationId) return conversationId;
    if (!user || !hasSupabaseConfig) return null;
    const { data, error: insertError } = await supabase
      .from("ai_chat_conversations")
      .insert({ user_id: user.id, title: title.slice(0, 80) || "Zentra AI Chat" })
      .select("id")
      .single();
    if (insertError) throw insertError;
    setConversationId(data.id);
    return data.id as string;
  };

  const saveRemoteMessage = async (conversation_id: string | null, message: Message) => {
    if (!conversation_id || !hasSupabaseConfig) return;
    const { error: insertError } = await supabase.from("ai_chat_messages").insert({
      conversation_id,
      role: message.role,
      content: message.content,
      created_at: message.timestamp.toISOString(),
    });
    if (insertError) throw insertError;
    await supabase
      .from("ai_chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversation_id);
  };

  useEffect(() => {
    let active = true;
    const loadChatHistory = async () => {
      const localMessages = readLocalAiMessages(user?.id);
      if (!user || !hasSupabaseConfig) {
        if (active) setMessages(localMessages);
        return;
      }
      const { data: conversations, error: conversationError } = await supabase
        .from("ai_chat_conversations")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (conversationError) {
        if (active) {
          setMessages(localMessages);
          setError(conversationError.message);
        }
        return;
      }
      const currentConversationId = conversations?.[0]?.id as string | undefined;
      if (!currentConversationId) {
        if (active) setMessages(localMessages);
        return;
      }
      const { data: rows, error: messageError } = await supabase
        .from("ai_chat_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", currentConversationId)
        .order("created_at", { ascending: true });
      if (messageError) {
        if (active) {
          setMessages(localMessages);
          setError(messageError.message);
        }
        return;
      }
      const remoteMessages: Message[] = (rows ?? []).map((row) => ({
        id: String(row.id),
        role: row.role as "assistant" | "user",
        content: String(row.content),
        timestamp: new Date(row.created_at),
      }));
      if (active) {
        setConversationId(currentConversationId);
        setMessages(remoteMessages.length ? remoteMessages : localMessages);
      }
    };
    void loadChatHistory();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError("");
    setInput("");
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    persistLocalMessage(userMessage);
    setTyping(true);
    let currentConversationId: string | null = null;
    try {
      try {
        currentConversationId = await ensureConversation(trimmed);
        await saveRemoteMessage(currentConversationId, userMessage);
      } catch (historyError) {
        setError(historyError instanceof Error ? historyError.message : "Could not save chat history.");
      }
      const answer = await askZentra(trimmed);
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer.answer,
        timestamp: new Date(),
      };
      persistLocalMessage(assistantMessage);
      try {
        await saveRemoteMessage(currentConversationId, assistantMessage);
      } catch (historyError) {
        setError(historyError instanceof Error ? historyError.message : "Could not save chat history.");
      }
    } catch (err) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: err instanceof Error ? err.message : "Unable to reach Zentra AI right now.",
        timestamp: new Date(),
      };
      persistLocalMessage(errorMessage);
    } finally {
      setTyping(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto h-[calc(100vh-9rem)] flex flex-col">
        <div className="flex items-center gap-3 pb-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-primary grid place-items-center shadow-[0_10px_30px_-10px_var(--glow)]">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Zentra AI</h1>
            <p className="text-sm text-muted-foreground">Your personal fitness & nutrition coach</p>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</div>
        )}

        <div ref={scrollRef} className="flex-1 card-elevated p-5 sm:p-6 overflow-y-auto space-y-4">
          {messages.length === 0 && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-surface-elevated border border-border rounded-bl-md">
                Hi {profile?.first_name ?? "there"} 👋 I'm Zentra AI. Ask me anything about training, nutrition, or recovery.
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-gradient-primary text-white rounded-br-md shadow-[0_8px_24px_-10px_var(--glow)]"
                  : "bg-surface-elevated border border-border rounded-bl-md",
              )}>
                {m.content}
                <p className={cn("text-[10px] mt-1.5 opacity-70", m.role === "user" ? "text-white" : "text-muted-foreground")}>
                  {m.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 text-sm bg-surface-elevated border border-border inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Zentra is typing…
              </div>
            </div>
          )}
        </div>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 pt-4">
            {suggestions.map((s) => (
              <button key={s} onClick={() => setInput(s)}
                className="px-4 py-2 rounded-full text-sm bg-surface border border-border hover:border-primary/40 hover:text-primary transition">
                {s}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="mt-3 flex items-center gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Zentra anything..."
            className="flex-1 h-14 px-5 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20" />
          <button type="submit" disabled={!input.trim() || typing}
            className="h-14 w-14 rounded-2xl bg-gradient-primary grid place-items-center shadow-[0_10px_30px_-10px_var(--glow)] hover:brightness-110 transition disabled:opacity-60">
            <Send className="h-5 w-5 text-white" />
          </button>
        </form>
      </div>
    </AppShell>
  );
}
