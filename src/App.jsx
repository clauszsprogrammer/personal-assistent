import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  CheckCircle2,
  Wallet,
  Plus,
  Minus,
  Send,
  Trash2,
  Loader2,
  Sparkles,
  Pencil,
  PiggyBank,
  Landmark,
  ClipboardList,
  Mic,
  ImagePlus,
  X,
  History
} from 'lucide-react';

const COLORS = {
  bg: '#EEF0EC',
  surface: '#FFFFFF',
  ink: '#1F2421',
  inkMuted: '#5B6660',
  accent: '#2F5D50',
  accentLight: '#DCE8E3',
  gold: '#B8863B',
  goldLight: '#F3E7D0',
  border: '#DEDDD3',
};

const DARK = {
  surface: 'rgba(255,255,255,0.06)',
  surfaceSolid: '#180F28',
  border: 'rgba(168,123,255,0.22)',
  ink: '#F4EFFB',
  inkMuted: '#B3A2D6',
  accent: '#B48CFF',
  accentLight: 'rgba(180,140,255,0.18)',
};

const CHAT_THEME = {
  pageBg:
    'radial-gradient(circle at 12% 0%, rgba(70,147,124,0.32), transparent 48%), radial-gradient(circle at 88% 92%, rgba(120,90,220,0.22), transparent 50%), linear-gradient(165deg, #0A1512 0%, #0E1D19 55%, #0A1512 100%)',
  surface: 'rgba(255,255,255,0.07)',
  surfaceSolid: '#0E1D19',
  border: 'rgba(255,255,255,0.10)',
  ink: '#EAF3EF',
  inkMuted: '#9FB6AE',
  accent: '#5FD3AE',
  userBubble: 'linear-gradient(135deg, #2F5D50, #46937C)',
};

const THEMES = {
  chat: {
    pageBg: CHAT_THEME.pageBg,
    headerMain: CHAT_THEME.ink,
    headerSub: CHAT_THEME.inkMuted,
    navBg: CHAT_THEME.surfaceSolid,
    navBorder: CHAT_THEME.border,
    accent: CHAT_THEME.accent
  },
  tasks: {
    pageBg: 'linear-gradient(165deg, #0A0712 0%, #1B0F2E 45%, #2E1656 100%)',
    headerMain: DARK.ink,
    headerSub: DARK.inkMuted,
    navBg: DARK.surfaceSolid,
    navBorder: DARK.border,
    accent: DARK.accent
  },
  finance: {
    pageBg: COLORS.bg,
    headerMain: COLORS.ink,
    headerSub: COLORS.inkMuted,
    navBg: COLORS.surface,
    navBorder: COLORS.border,
    accent: COLORS.gold
  }
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function todayLabel() {
  const d = new Date();

  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);

  return d.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });
}

function fmtBRL(v) {
  return `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
}

const SYSTEM_BASE = `Você é Íris, um assistente pessoal dentro de um app. Sua única função aqui é conversar: tirar dúvidas, bater papo, ajudar a pensar sobre algo, e também pode analisar imagens que a pessoa enviar.
Regras:
- Responda sempre em português do Brasil.
- Seja direta, breve e gentil, sem respostas genéricas de IA.
- Você não controla tarefas nem gastos por aqui — se a pessoa pedir isso, avise gentilmente que ela pode fazer isso nas abas de Tarefas ou Finanças do app.`;

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

/* =========================================================
   ARMAZENAMENTO
   Substitui window.storage pelo localStorage do navegador.
   ========================================================= */

function storageGet(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);

    if (value === null) {
      return fallback;
    }

    return JSON.parse(value);
  } catch (error) {
    console.error(`Erro ao ler ${key}:`, error);
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Erro ao salvar ${key}:`, error);
  }
}

export default function App() {
  const [tab, setTab] = useState('chat');

  const [tasks, setTasks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balance, setBalance] = useState(0);
  const [savings, setSavings] = useState(0);
  const [history, setHistory] = useState([]);

  const [apiMessages, setApiMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const scrollRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  /* =========================================================
     CARREGAMENTO DOS DADOS
     ========================================================= */

  useEffect(() => {
    try {
      let loadedTasks = storageGet('assistente-tasks', []);
      let loadedExpenses = storageGet('assistente-expenses', []);
      let loadedChat = storageGet('assistente-chat', []);
      let loadedBalance = storageGet('assistente-balance', 0);
      let loadedSavings = storageGet('assistente-savings', 0);
      let loadedHistory = storageGet('assistente-history', []);

      let lastMonth = storageGet('assistente-lastmonth', null);

      const nowD = new Date();

      const currentKey = `${nowD.getFullYear()}-${String(
        nowD.getMonth() + 1
      ).padStart(2, '0')}`;

      /*
       * Fecha o mês anterior automaticamente.
       */
      if (lastMonth && lastMonth !== currentKey) {
        const [ly, lm2] = lastMonth.split('-').map(Number);

        const closedExpenses = loadedExpenses.filter((e) => {
          const d = new Date(e.date);

          return (
            d.getFullYear() === ly &&
            d.getMonth() + 1 === lm2
          );
        });

        const gastos = closedExpenses.reduce(
          (s, e) => s + Number(e.amount || 0),
          0
        );

        const record = {
          key: lastMonth,
          gastos,
          saldo: loadedBalance,
          guardado: loadedSavings,
          patrimonio:
            Number(loadedBalance) + Number(loadedSavings),
          saldoAposGastos:
            Number(loadedBalance) - gastos,
          closedAt: Date.now()
        };

        loadedHistory = [...loadedHistory, record].slice(-12);

        loadedExpenses = loadedExpenses.filter((e) => {
          const d = new Date(e.date);

          return !(
            d.getFullYear() === ly &&
            d.getMonth() + 1 === lm2
          );
        });

        storageSet('assistente-history', loadedHistory);
        storageSet('assistente-expenses', loadedExpenses);
      }

      storageSet('assistente-lastmonth', currentKey);

      setTasks(Array.isArray(loadedTasks) ? loadedTasks : []);
      setExpenses(
        Array.isArray(loadedExpenses) ? loadedExpenses : []
      );
      setApiMessages(
        Array.isArray(loadedChat) ? loadedChat : []
      );
      setBalance(Number(loadedBalance) || 0);
      setSavings(Number(loadedSavings) || 0);
      setHistory(
        Array.isArray(loadedHistory) ? loadedHistory : []
      );

      setLoaded(true);
    } catch (error) {
      console.error('Erro ao carregar aplicação:', error);
      setLoaded(true);
    }
  }, []);

  /* =========================================================
     SALVAMENTO AUTOMÁTICO
     ========================================================= */

  useEffect(() => {
    if (loaded) {
      storageSet('assistente-tasks', tasks);
    }
  }, [tasks, loaded]);

  useEffect(() => {
    if (loaded) {
      storageSet('assistente-expenses', expenses);
    }
  }, [expenses, loaded]);

  useEffect(() => {
    if (loaded) {
      storageSet(
        'assistente-chat',
        apiMessages.slice(-40)
      );
    }
  }, [apiMessages, loaded]);

  useEffect(() => {
    if (loaded) {
      storageSet('assistente-balance', balance);
    }
  }, [balance, loaded]);

  useEffect(() => {
    if (loaded) {
      storageSet('assistente-savings', savings);
    }
  }, [savings, loaded]);

  /* =========================================================
     SCROLL DO CHAT
     ========================================================= */

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight;
    }
  }, [apiMessages, loading]);

  /* =========================================================
     VOZ
     ========================================================= */

  function toggleVoice() {
    if (!SpeechRecognitionAPI) {
      alert(
        'O reconhecimento de voz não está disponível neste navegador.'
      );
      return;
    }

    if (listening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      setListening(false);
      return;
    }

    const rec = new SpeechRecognitionAPI();

    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const transcript =
        e.results[0][0].transcript;

      setInput((prev) =>
        prev ? `${prev} ${transcript}` : transcript
      );
    };

    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recognitionRef.current = rec;

    setListening(true);

    try {
      rec.start();
    } catch (error) {
      console.error(error);
      setListening(false);
    }
  }

  /* =========================================================
     IMAGEM
     ========================================================= */

  function handleImageSelect(e) {
    const file =
      e.target.files && e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = reader.result;

      const match =
        /^data:(.*);base64,(.*)$/.exec(dataUrl);

      if (match) {
        setPendingImage({
          mediaType: match[1],
          base64: match[2],
          dataUrl
        });
      }
    };

    reader.readAsDataURL(file);

    e.target.value = '';
  }

  /* =========================================================
     CHAT
     ========================================================= */

  async function sendMessage() {
    const text = input.trim();

    if (!text && !pendingImage) return;
    if (loading) return;

    setInput('');

    const img = pendingImage;

    setPendingImage(null);
    setLoading(true);

    const content = img
      ? [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: img.mediaType,
              data: img.base64
            }
          },
          {
            type: 'text',
            text:
              text ||
              'O que você vê nessa imagem?'
          }
        ]
      : text;

    let msgs = [
      ...apiMessages,
      {
        role: 'user',
        content
      }
    ];

    setApiMessages(msgs);

    try {
  const messageText =
    typeof content === 'string'
      ? content
      : content
          .filter((item) => item.type === 'text')
          .map((item) => item.text)
          .join(' ');

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `${SYSTEM_BASE}\n\nHoje é ${todayLabel()}.\n\nUsuário: ${messageText}`
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Erro ao comunicar com a IA');
  }

  msgs = [
    ...msgs,
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: data.reply
        }
      ]
    }
  ];

} catch (error) {
  console.error('Erro na IA:', error);

  msgs = [
    ...msgs,
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Ops, tive um problema para responder agora. Tenta de novo?'
        }
      ]
    }
  ];
}
    setApiMessages(msgs);
    setLoading(false);
  }

  /* =========================================================
     MENSAGENS EXIBIDAS
     ========================================================= */

  const displayMessages = apiMessages
    .map((m) => {
      if (typeof m.content === 'string') {
        return {
          role: m.role,
          text: m.content,
          images: []
        };
      }

      if (Array.isArray(m.content)) {
        const text = m.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join(' ');

        const images = m.content
          .filter((b) => b.type === 'image')
          .map(
            (b) =>
              `data:${b.source.media_type};base64,${b.source.data}`
          );

        if (!text && images.length === 0) {
          return null;
        }

        return {
          role: m.role,
          text,
          images
        };
      }

      return null;
    })
    .filter(Boolean);

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const now = new Date();

  const monthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);

    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  });

  const monthTotal = monthExpenses.reduce(
    (s, e) => s + Number(e.amount || 0),
    0
  );

  const theme = THEMES[tab];

  return (
    <div
      style={{
        background: theme.pageBg,
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
        color: theme.headerMain,
        transition: 'background 0.25s ease'
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');

        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          margin: 0;
          min-height: 100%;
          width: 100%;
        }

        body {
          margin: 0;
          -webkit-font-smoothing: antialiased;
          -webkit-text-size-adjust: 100%;
          overscroll-behavior: none;
        }

        button {
          font-family: inherit;
          -webkit-tap-highlight-color: transparent;
        }

        input,
        textarea {
          font-family: inherit;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(255,90,90,0.5);
          }

          50% {
            box-shadow: 0 0 0 8px rgba(255,90,90,0);
          }
        }
      `}</style>

      <div
        style={{
          width: '100%',
          maxWidth: 430,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        <div
          style={{
            padding: '28px 20px 16px'
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: theme.headerSub,
              textTransform: 'capitalize'
            }}
          >
            {todayLabel()}
          </div>

          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontWeight: 600,
              fontSize: 26,
              marginTop: 2,
              color: theme.headerMain
            }}
          >
            {tab === 'chat' && 'Conversa'}
            {tab === 'tasks' && 'Tarefas'}
            {tab === 'finance' && 'Finanças'}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingBottom:
              tab === 'chat' ? 150 : 90
          }}
        >
          {tab === 'chat' && (
            <div
              ref={scrollRef}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '4px 16px',
                minHeight: 300
              }}
            >
              {displayMessages.length === 0 && (
                <div
                  style={{
                    color: CHAT_THEME.inkMuted,
                    fontSize: 14,
                    padding: '24px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <Sparkles size={16} />

                  Tire uma dúvida, mande uma imagem
                  ou fale por voz. Tarefas e gastos
                  ficam nas outras abas.
                </div>
              )}

              {displayMessages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf:
                      m.role === 'user'
                        ? 'flex-end'
                        : 'flex-start',
                    background:
                      m.role === 'user'
                        ? CHAT_THEME.userBubble
                        : CHAT_THEME.surface,
                    backdropFilter: 'blur(10px)',
                    color: CHAT_THEME.ink,
                    border:
                      m.role === 'user'
                        ? 'none'
                        : `1px solid ${CHAT_THEME.border}`,
                    borderRadius: 16,
                    borderBottomRightRadius:
                      m.role === 'user' ? 4 : 16,
                    borderBottomLeftRadius:
                      m.role === 'user' ? 16 : 4,
                    padding: '10px 12px',
                    maxWidth: '78%',
                    fontSize: 14.5,
                    lineHeight: 1.45
                  }}
                >
                  {m.images &&
                    m.images.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          marginBottom: m.text
                            ? 8
                            : 0,
                          flexWrap: 'wrap'
                        }}
                      >
                        {m.images.map(
                          (src, idx) => (
                            <img
                              key={idx}
                              src={src}
                              alt="enviada"
                              style={{
                                width: 140,
                                maxWidth: '100%',
                                borderRadius: 10,
                                display: 'block'
                              }}
                            />
                          )
                        )}
                      </div>
                    )}

                  {m.text}
                </div>
              ))}

              {loading && (
                <div
                  style={{
                    alignSelf: 'flex-start',
                    color: CHAT_THEME.inkMuted,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    padding: '4px 8px'
                  }}
                >
                  <Loader2
                    size={14}
                    style={{
                      animation:
                        'spin 1s linear infinite'
                    }}
                  />

                  pensando...
                </div>
              )}
            </div>
          )}

          {tab === 'tasks' && (
            <TasksView
              pending={pending}
              done={done}
              onToggle={(id, val) =>
                setTasks((ts) =>
                  ts.map((t) =>
                    t.id === id
                      ? { ...t, done: val }
                      : t
                  )
                )
              }
              onDelete={(id) =>
                setTasks((ts) =>
                  ts.filter((t) => t.id !== id)
                )
              }
              onAdd={(title) =>
                setTasks((ts) => [
                  ...ts,
                  {
                    id: uid(),
                    title,
                    done: false,
                    createdAt: Date.now()
                  }
                ])
              }
            />
          )}

          {tab === 'finance' && (
            <FinanceView
              expenses={expenses}
              monthTotal={monthTotal}
              balance={balance}
              savings={savings}
              history={history}
              onSetBalance={setBalance}
              onSavingsChange={(delta) =>
                setSavings((v) =>
                  Math.max(
                    0,
                    Number(v || 0) + delta
                  )
                )
              }
              onDelete={(id) =>
                setExpenses((es) =>
                  es.filter((e) => e.id !== id)
                )
              }
              onAdd={(
                description,
                amount,
                category
              ) =>
                setExpenses((es) => [
                  ...es,
                  {
                    id: uid(),
                    description,
                    amount,
                    category,
                    date: Date.now()
                  }
                ])
              }
              colors={COLORS}
            />
          )}
        </div>

        {tab === 'chat' && (
          <div
            style={{
              position: 'absolute',
              bottom: 68,
              left: 0,
              right: 0,
              padding: '8px 16px 12px',
              background:
                'linear-gradient(rgba(10,21,18,0), #0A1512 55%)'
            }}
          >
            {pendingImage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8
                }}
              >
                <div
                  style={{
                    position: 'relative'
                  }}
                >
                  <img
                    src={pendingImage.dataUrl}
                    alt="prévia"
                    style={{
                      width: 52,
                      height: 52,
                      objectFit: 'cover',
                      borderRadius: 10,
                      border: `1px solid ${CHAT_THEME.border}`
                    }}
                  />

                  <button
                    onClick={() =>
                      setPendingImage(null)
                    }
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: '#0A1512',
                      border: `1px solid ${CHAT_THEME.border}`,
                      color: CHAT_THEME.ink,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <X size={11} />
                  </button>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: CHAT_THEME.inkMuted
                  }}
                >
                  Imagem pronta para enviar
                </div>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 6,
                background: CHAT_THEME.surface,
                backdropFilter: 'blur(10px)',
                border: `1px solid ${CHAT_THEME.border}`,
                borderRadius: 22,
                padding: '6px 6px 6px 8px',
                alignItems: 'center'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: 'none' }}
              />

              <button
                onClick={() =>
                  fileInputRef.current &&
                  fileInputRef.current.click()
                }
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: 'none',
                  background:
                    'rgba(255,255,255,0.08)',
                  color: CHAT_THEME.ink,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <ImagePlus size={15} />
              </button>

              {SpeechRecognitionAPI && (
                <button
                  onClick={toggleVoice}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: 'none',
                    background: listening
                      ? '#E15C5C'
                      : 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    animation: listening
                      ? 'pulse 1.4s infinite'
                      : 'none'
                  }}
                >
                  <Mic size={15} />
                </button>
              )}

              <input
                value={input}
                onChange={(e) =>
                  setInput(e.target.value)
                }
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    !e.shiftKey
                  ) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={
                  listening
                    ? 'Ouvindo...'
                    : 'Escreva para a Íris...'
                }
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  fontSize: 14.5,
                  background: 'transparent',
                  color: CHAT_THEME.ink
                }}
              />

              <button
                onClick={sendMessage}
                disabled={
                  loading ||
                  (!input.trim() &&
                    !pendingImage)
                }
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: 'none',
                  background:
                    input.trim() ||
                    pendingImage
                      ? CHAT_THEME.accent
                      : 'rgba(255,255,255,0.1)',
                  color: '#08130F',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor:
                    input.trim() ||
                    pendingImage
                      ? 'pointer'
                      : 'default',
                  flexShrink: 0
                }}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 68,
            background: theme.navBg,
            borderTop: `1px solid ${theme.navBorder}`,
            display: 'flex',
            transition:
              'background 0.25s ease'
          }}
        >
          <NavButton
            active={tab === 'chat'}
            onClick={() => setTab('chat')}
            icon={<MessageCircle size={21} />}
            label="Chat"
            accent={THEMES.chat.accent}
            muted={theme.headerSub}
          />

          <NavButton
            active={tab === 'tasks'}
            onClick={() => setTab('tasks')}
            icon={<CheckCircle2 size={21} />}
            label="Tarefas"
            accent={THEMES.tasks.accent}
            muted={theme.headerSub}
          />

          <NavButton
            active={tab === 'finance'}
            onClick={() => setTab('finance')}
            icon={<Wallet size={21} />}
            label="Finanças"
            accent={THEMES.finance.accent}
            muted={theme.headerSub}
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   NAVEGAÇÃO
   ========================================================= */

function NavButton({
  active,
  onClick,
  icon,
  label,
  accent,
  muted
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        border: 'none',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        color: active ? accent : muted,
        cursor: 'pointer'
      }}
    >
      {icon}

      <span
        style={{
          fontSize: 11,
          fontWeight: active ? 600 : 500
        }}
      >
        {label}
      </span>
    </button>
  );
}

/* =========================================================
   TAREFAS
   ========================================================= */

function TasksView({
  pending,
  done,
  onToggle,
  onDelete,
  onAdd
}) {
  const [sub, setSub] = useState('pending');
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');

  const list =
    sub === 'pending' ? pending : done;

  return (
    <div style={{ padding: '4px 16px' }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16
        }}
      >
        <SubTab
          active={sub === 'pending'}
          onClick={() => setSub('pending')}
          label={`A fazer (${pending.length})`}
        />

        <SubTab
          active={sub === 'done'}
          onClick={() => setSub('done')}
          label={`Concluídas (${done.length})`}
        />
      </div>

      {list.length === 0 && (
        <div
          style={{
            color: DARK.inkMuted,
            fontSize: 14,
            padding: '20px 4px'
          }}
        >
          {sub === 'pending'
            ? 'Nenhuma tarefa pendente. Adicione uma abaixo.'
            : 'Nenhuma tarefa concluída ainda.'}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        {list.map((t) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: DARK.surface,
              backdropFilter: 'blur(6px)',
              border: `1px solid ${DARK.border}`,
              borderRadius: 18,
              padding: '13px 15px'
            }}
          >
            <button
              onClick={() =>
                onToggle(t.id, !t.done)
              }
              style={{
                border: 'none',
                background: t.done
                  ? DARK.accent
                  : 'transparent',
                width: 26,
                height: 26,
                borderRadius: '50%',
                boxShadow: t.done
                  ? '0 0 12px rgba(180,140,255,0.55)'
                  : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: t.done
                  ? '#180F28'
                  : DARK.inkMuted,
                outline: t.done
                  ? 'none'
                  : `1.5px solid ${DARK.border}`,
                cursor: 'pointer',
                flexShrink: 0,
                padding: 0
              }}
            >
              {t.done && (
                <CheckCircle2 size={16} />
              )}
            </button>

            <div
              style={{
                flex: 1,
                fontSize: 14.5,
                textDecoration: t.done
                  ? 'line-through'
                  : 'none',
                color: t.done
                  ? DARK.inkMuted
                  : DARK.ink
              }}
            >
              {t.title}
            </div>

            <button
              onClick={() => onDelete(t.id)}
              style={{
                border: 'none',
                background: 'transparent',
                color: DARK.inkMuted,
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            gap: 8
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) =>
              setTitle(e.target.value)
            }
            placeholder="Nova tarefa..."
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                title.trim()
              ) {
                onAdd(title.trim());
                setTitle('');
                setShowAdd(false);
              }
            }}
            style={{
              flex: 1,
              border: `1px solid ${DARK.border}`,
              background:
                'rgba(255,255,255,0.04)',
              color: DARK.ink,
              borderRadius: 999,
              padding: '12px 18px',
              fontSize: 14,
              outline: 'none'
            }}
          />

          <button
            onClick={() => {
              if (title.trim()) {
                onAdd(title.trim());
                setTitle('');
              }

              setShowAdd(false);
            }}
            style={{
              border: 'none',
              background: DARK.accent,
              color: '#180F28',
              fontWeight: 600,
              borderRadius: 999,
              padding: '0 20px',
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            OK
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          style={{
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'center',
            border: 'none',
            background:
              'linear-gradient(135deg, #7C4DFF, #B48CFF)',
            color: '#fff',
            borderRadius: 999,
            padding: '13px 14px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
            boxShadow:
              '0 6px 18px rgba(124,77,255,0.35)'
          }}
        >
          <Plus size={16} />
          Nova tarefa
        </button>
      )}
    </div>
  );
}

function SubTab({
  active,
  onClick,
  label
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: active
          ? 'none'
          : `1px solid ${DARK.border}`,
        background: active
          ? 'linear-gradient(135deg, #7C4DFF, #B48CFF)'
          : 'transparent',
        color: active
          ? '#fff'
          : DARK.inkMuted,
        borderRadius: 999,
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer'
      }}
    >
      {label}
    </button>
  );
}

/* =========================================================
   FINANÇAS
   ========================================================= */

function EditableStat({
  icon,
  label,
  value,
  bg,
  onSave
}) {
  const [editing, setEditing] =
    useState(false);

  const [draft, setDraft] = useState(
    String(value || '')
  );

  function save() {
    const v = parseFloat(
      String(draft).replace(',', '.')
    );

    onSave(isNaN(v) ? 0 : v);

    setEditing(false);
  }

  return (
    <div
      style={{
        flex: 1,
        background: bg,
        borderRadius: 16,
        padding: '14px 16px',
        color: '#fff',
        minWidth: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12.5,
            opacity: 0.9
          }}
        >
          {icon}
          {label}
        </div>

        {!editing && (
          <button
            onClick={() => {
              setDraft(String(value || ''));
              setEditing(true);
            }}
            style={{
              border: 'none',
              background:
                'rgba(255,255,255,0.2)',
              borderRadius: '50%',
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            <Pencil size={11} />
          </button>
        )}
      </div>

      {editing ? (
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 8
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) =>
              setDraft(e.target.value)
            }
            inputMode="decimal"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                save();
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              borderRadius: 8,
              padding: '6px 8px',
              fontSize: 15,
              outline: 'none'
            }}
          />

          <button
            onClick={save}
            style={{
              border: 'none',
              background:
                'rgba(255,255,255,0.25)',
              color: '#fff',
              borderRadius: 8,
              padding: '0 10px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            OK
          </button>
        </div>
      ) : (
        <div
          style={{
            fontFamily:
              "'Fraunces', serif",
            fontWeight: 700,
            fontSize: 22,
            marginTop: 4
          }}
        >
          {fmtBRL(value)}
        </div>
      )}
    </div>
  );
}

function PiggyBankStat({
  value,
  onChange,
  bg
}) {
  const [mode, setMode] =
    useState(null);

  const [draft, setDraft] =
    useState('');

  function confirm() {
    const v = parseFloat(
      draft.replace(',', '.')
    );

    if (!isNaN(v) && v > 0) {
      onChange(
        mode === 'add' ? v : -v
      );
    }

    setDraft('');
    setMode(null);
  }

  return (
    <div
      style={{
        flex: 1,
        background: bg,
        borderRadius: 16,
        padding: '14px 16px',
        color: '#fff',
        minWidth: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12.5,
            opacity: 0.9
          }}
        >
          <PiggyBank size={13} />
          Guardado
        </div>

        {!mode && (
          <div
            style={{
              display: 'flex',
              gap: 4
            }}
          >
            <button
              onClick={() =>
                setMode('remove')
              }
              style={{
                border: 'none',
                background:
                  'rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              <Minus size={12} />
            </button>

            <button
              onClick={() =>
                setMode('add')
              }
              style={{
                border: 'none',
                background:
                  'rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>

      {mode ? (
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginTop: 8
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) =>
              setDraft(e.target.value)
            }
            inputMode="decimal"
            placeholder={
              mode === 'add'
                ? 'guardar...'
                : 'retirar...'
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                confirm();
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              borderRadius: 8,
              padding: '6px 8px',
              fontSize: 14,
              outline: 'none'
            }}
          />

          <button
            onClick={confirm}
            style={{
              border: 'none',
              background:
                'rgba(255,255,255,0.25)',
              color: '#fff',
              borderRadius: 8,
              padding: '0 10px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            OK
          </button>
        </div>
      ) : (
        <div
          style={{
            fontFamily:
              "'Fraunces', serif",
            fontWeight: 700,
            fontSize: 22,
            marginTop: 4
          }}
        >
          {fmtBRL(value)}
        </div>
      )}
    </div>
  );
}

function FinanceView({
  expenses,
  monthTotal,
  balance,
  savings,
  history,
  onSetBalance,
  onSavingsChange,
  onDelete,
  onAdd,
  colors
}) {
  const [showAdd, setShowAdd] =
    useState(false);

  const [desc, setDesc] =
    useState('');

  const [amount, setAmount] =
    useState('');

  const sorted = [...expenses].sort(
    (a, b) => b.date - a.date
  );

  const patrimonio =
    Number(balance || 0) +
    Number(savings || 0);

  const saldoAposGastos =
    Number(balance || 0) - monthTotal;

  const recentHistory = [...history]
    .reverse()
    .slice(0, 3);

  function submit() {
    const v = parseFloat(
      amount.replace(',', '.')
    );

    if (
      desc.trim() &&
      !isNaN(v) &&
      v > 0
    ) {
      onAdd(
        desc.trim(),
        v,
        'geral'
      );

      setDesc('');
      setAmount('');
      setShowAdd(false);
    }
  }

  return (
    <div style={{ padding: '4px 16px' }}>
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 10
        }}
      >
        <EditableStat
          icon={<Landmark size={13} />}
          label="Na conta"
          value={balance}
          bg="linear-gradient(135deg, #2F5D50, #3E7A69)"
          onSave={onSetBalance}
        />

        <PiggyBankStat
          value={savings}
          onChange={onSavingsChange}
          bg="linear-gradient(135deg, #8A6A2F, #B8863B)"
        />
      </div>

      <div
        style={{
          background: colors.gold,
          borderRadius: 16,
          padding: '16px 18px',
          color: '#fff',
          marginBottom: 10
        }}
      >
        <div
          style={{
            fontSize: 12.5,
            opacity: 0.9
          }}
        >
          Gastos deste mês
        </div>

        <div
          style={{
            fontFamily:
              "'Fraunces', serif",
            fontWeight: 700,
            fontSize: 28,
            marginTop: 2
          }}
        >
          {fmtBRL(monthTotal)}
        </div>
      </div>

      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: '15px 18px',
          marginBottom: 12
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: colors.ink,
            marginBottom: 10
          }}
        >
          <ClipboardList
            size={15}
            color={colors.gold}
          />

          Relação do mês
        </div>

        <SummaryRow
          label="Na conta"
          value={fmtBRL(balance)}
          colors={colors}
        />

        <SummaryRow
          label="Guardado"
          value={fmtBRL(savings)}
          colors={colors}
        />

        <SummaryRow
          label="Gastos do mês"
          value={`- ${fmtBRL(monthTotal)}`}
          colors={colors}
          negative
        />

        <div
          style={{
            height: 1,
            background: colors.border,
            margin: '8px 0'
          }}
        />

        <SummaryRow
          label="Patrimônio total"
          value={fmtBRL(patrimonio)}
          colors={colors}
          bold
        />

        <SummaryRow
          label="Saldo após gastos do mês"
          value={fmtBRL(saldoAposGastos)}
          colors={colors}
          bold
          negative={saldoAposGastos < 0}
        />
      </div>

      {recentHistory.length > 0 && (
        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: '15px 18px',
            marginBottom: 18
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: colors.ink,
              marginBottom: 8
            }}
          >
            <History
              size={15}
              color={colors.gold}
            />

            Meses anteriores
          </div>

          {recentHistory.map((h) => (
            <div
              key={h.key}
              style={{
                padding: '6px 0',
                borderBottom: `1px solid ${colors.border}`
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.ink,
                  textTransform:
                    'capitalize',
                  marginBottom: 3
                }}
              >
                {monthLabel(h.key)}
              </div>

              <SummaryRow
                label="Gastos"
                value={fmtBRL(h.gastos)}
                colors={colors}
              />

              <SummaryRow
                label="Saldo após gastos"
                value={fmtBRL(
                  h.saldoAposGastos
                )}
                colors={colors}
                negative={
                  h.saldoAposGastos < 0
                }
              />
            </div>
          ))}
        </div>
      )}

      {sorted.length === 0 && (
        <div
          style={{
            color: colors.inkMuted,
            fontSize: 14,
            padding: '4px 4px 10px'
          }}
        >
          Nenhum gasto registrado este mês.
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        {sorted.map((e) => (
          <div
            key={e.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: '12px 14px'
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 14.5
                }}
              >
                {e.description}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: colors.inkMuted,
                  marginTop: 2
                }}
              >
                {new Date(
                  e.date
                ).toLocaleDateString(
                  'pt-BR'
                )}{' '}
                · {e.category || 'geral'}
              </div>
            </div>

            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: colors.gold
              }}
            >
              {fmtBRL(e.amount)}
            </div>

            <button
              onClick={() => onDelete(e.id)}
              style={{
                border: 'none',
                background: 'transparent',
                color: colors.inkMuted,
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <input
            autoFocus
            value={desc}
            onChange={(e) =>
              setDesc(e.target.value)
            }
            placeholder="Descrição (ex: mercado)"
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 14,
              outline: 'none'
            }}
          />

          <div
            style={{
              display: 'flex',
              gap: 8
            }}
          >
            <input
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value)
              }
              placeholder="Valor (R$)"
              inputMode="decimal"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  submit();
                }
              }}
              style={{
                flex: 1,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 14,
                outline: 'none'
              }}
            />

            <button
              onClick={submit}
              style={{
                border: 'none',
                background: colors.gold,
                color: '#fff',
                borderRadius: 10,
                padding: '0 16px',
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              OK
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: `1px dashed ${colors.border}`,
            background: 'transparent',
            color: colors.gold,
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 14,
            cursor: 'pointer',
            width: '100%',
            justifyContent: 'center'
          }}
        >
          <Plus size={16} />
          Novo gasto
        </button>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  colors,
  bold,
  negative
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 0',
        fontSize: bold ? 14.5 : 13.5,
        fontWeight: bold ? 700 : 400,
        color: negative
          ? '#B4483A'
          : colors.ink
      }}
    >
      <span
        style={{
          color: bold
            ? colors.ink
            : colors.inkMuted
        }}
      >
        {label}
      </span>

      <span>{value}</span>
    </div>
  );
}
