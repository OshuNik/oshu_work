import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SERVICE_KEY") ?? "";
const AI_API_KEY = Deno.env.get("AI_API_KEY") ?? "";
const PARSER_SECRET = Deno.env.get("PARSER_SECRET") ?? "";
const supabase = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null;
const rateLimitMap = new Map();
const RATE_LIMIT_CONFIG = {
  requestsPerWindow: 100,
  windowSizeMs: 60 * 1000,
  blockedDurationMs: 60 * 1000
};
function checkRateLimit(clientId) {
  const now = Date.now();
  const record = rateLimitMap.get(clientId);
  if (record?.blockedUntil && now < record.blockedUntil) {
    const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      allowed: false,
      retryAfter
    };
  }
  if (!record || now >= record.resetTime) {
    rateLimitMap.set(clientId, {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.windowSizeMs
    });
    return {
      allowed: true
    };
  }
  record.count++;
  if (record.count > RATE_LIMIT_CONFIG.requestsPerWindow) {
    record.blockedUntil = now + RATE_LIMIT_CONFIG.blockedDurationMs;
    console.warn(`⚠️ Rate limit exceeded for client ${clientId}`);
    const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      allowed: false,
      retryAfter
    };
  }
  return {
    allowed: true
  };
}
setInterval(()=>{
  const now = Date.now();
  const entriesToDelete = [];
  for (const [clientId, record] of rateLimitMap.entries()){
    if (now >= record.resetTime && (!record.blockedUntil || now >= record.blockedUntil)) {
      entriesToDelete.push(clientId);
    }
  }
  entriesToDelete.forEach((clientId)=>rateLimitMap.delete(clientId));
  if (entriesToDelete.length > 0) {
    console.debug(`🧹 Cleaned up ${entriesToDelete.length} expired rate limit records`);
  }
}, 5 * 60 * 1000);
function validateParserSecret(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7);
  if (!token || !PARSER_SECRET) {
    return false;
  }
  return token === PARSER_SECRET;
}
// УТИЛИТЫ
const asStr = (v)=>(v == null ? "" : String(v)).trim();
const asArr = (v)=>Array.isArray(v) ? v.map(asStr).filter(Boolean) : asStr(v).split(/[;,]/g).map(asStr).filter(Boolean);
const escapeHtml = (s)=>s.replace(/[&<>"']/g, (c)=>({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[c] || c);
const escapeRe = (s)=>s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tsIso = (v)=>{
  const s = asStr(v);
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};
const isHttp = (u)=>/^https?:/i.test(u);
const isTg = (u)=>/^tg:/i.test(u);
const isHttpOrTg = (u)=>isHttp(u) || isTg(u);
const safeHttp = (v)=>{
  const s = asStr(v);
  if (!s) return "";
  try {
    const u = new URL(s);
    return /^https?:$/i.test(u.protocol) ? u.toString() : "";
  } catch  {
    return "";
  }
};
const safeHttpOrTg = (v)=>{
  const s = asStr(v);
  if (!s) return "";
  try {
    const u = new URL(s);
    return /^https?:|^tg:/i.test(u.protocol) ? u.toString() : "";
  } catch  {
    return "";
  }
};
const isTelegramPostUrl = (url)=>{
  try {
    const u = new URL(url);
    if (u.protocol === "tg:") return false;
    if (u.hostname !== "t.me" && u.hostname !== "telegram.me") return false;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length >= 2 && /^\d+/.test(parts[1] || "");
  } catch  {
    return false;
  }
};
const stripTags = (s)=>s.replace(/<[^>]*>/g, "");
function makeAnchor(url, label) {
  const href = safeHttpOrTg(url);
  if (!href) return escapeHtml(label);
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}
function extractInlineLinksToPlaceholders(raw) {
  const anchors = [];
  let text = raw;
  text = text.replace(/\[([^\]]+)\]\(((?:https?:\/\/|tg:\/\/)[^\s)<>"]+)\)/gi, (_m, label, href)=>{
    const ph = `__A${anchors.length}__`;
    anchors.push(makeAnchor(href, String(label)));
    return ph;
  });
  text = text.replace(/<a\s+[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label)=>{
    const ph = `__A${anchors.length}__`;
    anchors.push(makeAnchor(href, stripTags(String(label))));
    return ph;
  });
  return {
    text,
    anchors
  };
}
function linkify(html) {
  return html.replace(/\b(?:https?:\/\/|tg:\/\/)[^\s<>'"\)]+/gi, (m)=>`<a href="${safeHttpOrTg(m)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m)}</a>`).replace(/(^|\s)@([a-zA-Z0-9_]{3,32})\b/g, (_m, p1, u)=>`${p1}<a href="https://t.me/${u}" target="_blank" rel="noopener noreferrer">@${u}</a>`).replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
}
const highlight = (html, kw)=>kw.trim() ? html.replace(new RegExp(escapeRe(kw), "gi"), (m)=>`<span class="highlight">${m}</span>`) : html;
function extractTelegramHandle(text) {
  const re = /(^|[^@\w])@([A-Za-z0-9_]{3,32})\b/g;
  let m;
  while((m = re.exec(text)) !== null){
    const user = m[2];
    if (user) return `https://t.me/${user}`;
  }
  return "";
}
function extractApplyLinkFromText(rawText) {
  const text = rawText.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/[（﹙⟮]/g, "(").replace(/[）﹚⟯]/g, ")").replace(/\u00A0/g, " ");
  const mdHrefs = Array.from(text.matchAll(/\[[^\]]+]\(((?:https?:\/\/|tg:\/\/)[^\s)<>"]+)\)/gi)).map((m)=>m[1]);
  const aHrefs = Array.from(text.matchAll(/<a\s+[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>/gi)).map((m)=>m[1]);
  const rawLinks = (text.match(/\b(?:https?:\/\/|tg:\/\/)[^\s<>'"\)]+/gi) || []).map(String);
  const all = [
    ...mdHrefs,
    ...aHrefs,
    ...rawLinks
  ];
  const prefs = [
    /forms\.gle/i,
    /docs\.google\.com\/forms/i,
    /typeform\.com/i,
    /forms\.yandex/i,
    /hh\.ru/i,
    /career\./i,
    /lever\.co/i,
    /workable\.com/i,
    /greenhouse\.io/i,
    /notion\.site/i
  ];
  for (const re of prefs){
    const f = all.find((u)=>re.test(u) && isHttpOrTg(u));
    if (f) return f;
  }
  const tg = all.find((u)=>isTg(u) || /t\.me|telegram\.me/i.test(u) && !isTelegramPostUrl(u));
  if (tg) return tg;
  const handle = extractTelegramHandle(text);
  if (handle) return handle;
  return all.find(isHttpOrTg) || "";
}
function extractCompanyUrl(text, companyName) {
  const mdHrefs = Array.from(text.matchAll(/\[[^\]]+]\((https?:\/\/[^\s)<>"]+)\)/gi)).map((m)=>m[1]);
  const aHrefs = Array.from(text.matchAll(/<a\s+[^>]*?href\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*>/gi)).map((m)=>m[1]);
  const links = [
    ...mdHrefs,
    ...aHrefs,
    ...text.match(/\bhttps?:\/\/[^\s)'\">]+/gi) || []
  ];
  const bad = /(t\.me|telegram\.me|forms\.gle|docs\.google\.com\/forms|typeform\.com|hh\.ru|notion\.site)/i;
  const candidates = links.filter((u)=>safeHttp(u) && !bad.test(u));
  if (!candidates.length) return "";
  if (companyName) {
    const token = companyName.toLowerCase().split(/\s+/).filter(Boolean)[0] || "";
    try {
      const byName = candidates.find((u)=>new URL(u).hostname.toLowerCase().includes(token));
      if (byName) return byName;
    } catch  {}
  }
  return candidates[0];
}
async function openaiStrict(body, retries = 2) {
  const url = "https://api.openai.com/v1/chat/completions";
  let last = null;
  for(let i = 0; i <= retries; i++){
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${AI_API_KEY}`
        },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(`AI ${r.status} ${await r.text()}`);
      return await r.json();
    } catch (e) {
      last = e;
      await new Promise((r)=>setTimeout(r, 500 * (i + 1)));
    }
  }
  throw last ?? new Error("AI failed");
}
const SYSTEM_PROMPT = `
Ты — ассистент по разбору вакансий ИМЕННО для моушн-дизайнера / видеомонтажёра.
Верни СТРОГО валидный JSON по схеме, без лишних полей/комментариев/Markdown.

СХЕМА:
{
  "category": "ТОЧНО ТВОЁ" | "МОЖЕТ БЫТЬ" | "НЕ ТВОЁ",
  "reason": "коротко, 1–2 фразы",
  "apply_url": "https://... | tg://..." | "",
  "company_url": "https://..." | "",
  "company_name": "строка | 'не указано'",
  "skills": ["до 6 релевантных навыков"],
  "employment_type": "проект / частичная / полная / стажировка / не указано",
  "work_format": "удалёнка / офис / гибрид / не указано",
  "salary_display_text": "строка | 'не указано'",
  "industry": "строка | 'не указано'"
}

КЛАССИФИКАЦИЯ:
- "ТОЧНО ТВОЁ": монтаж/моушн — ядро задач (After Effects, Premiere Pro, 2D/3D анимация, монтаж Reels/Shorts/TikTok, композитинг, цветокоррекция).
- "МОЖЕТ БЫТЬ": роль смежная (контент-мейкер/SMM/дизайнер), но значимая часть — монтаж/моушн; или требования частично подходят.
- "НЕ ТВОЁ": нерелевантно (программист, маркетолог без монтажа, продажник, HR и т.п.) или монтаж/моушн упомянут вскользь.

ССЫЛКИ:
- "apply_url": выбери ОДНУ лучшую ссылку ДЛЯ ОТКЛИКА из текста: формы (Google/Yandex/Typeform/Tally), ATS/карьеры (Greenhouse/Lever/Workable/HH/Notion-форма), либо прямой контакт в Telegram (tg://... или @username).
  НЕ используй ссылку на пост t.me/... как apply_url. Если ничего подходящего нет — верни "".
- "company_url": официальный сайт компании, если есть в тексте. Иначе — "".
- Не выдумывай ссылки — только реально присутствующие во входном тексте.

ДАННЫЕ:
- "company_name": по тексту; если нет — "не указано".
- "skills": до 6, без повторов, только по теме (напр.: "After Effects", "Premiere Pro", "2D-анимация", "композитинг", "монтаж Reels", "цветокоррекция", "Cinema 4D", "Blender").
- "employment_type" / "work_format": выбери из списка; если не ясно — "не указано".
- "salary_display_text": как в тексте ("от 120 000 ₽", "1000–1500$ за проект"); если нет — "не указано".
- "industry": кратко по смыслу ("геймдев", "медиа", "маркетинг", "образование", "e-commerce", "финтех"); если нет — "не указано".

ТРЕБОВАНИЯ К ВЫВОДУ:
- Верни СТРОГО JSON по схеме выше, без лишних полей и текста.
- Все строки — на русском.
`.trim();
function cors(req) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigins = [
    "https://oshunik.github.io",
    "https://oshu-work.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ];
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400"
  };
}
function json(body, status = 200, req, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...cors(req),
      ...extraHeaders
    }
  });
}
serve(async (req)=>{
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors(req)
      });
    }
    if (req.method !== "POST") {
      return json({
        error: "Method Not Allowed"
      }, 405, req);
    }
    // PARSER SECRET VALIDATION
    const authHeader = req.headers.get("Authorization") || "";
    const isValidSecret = validateParserSecret(authHeader);
    if (!isValidSecret) {
      console.warn("❌ Parser secret validation failed");
      return json({
        error: "Unauthorized - Invalid or missing parser secret"
      }, 401, req);
    }
    // RATE LIMITING
    let clientId = req.headers.get("x-client-id") || req.headers.get("x-forwarded-for") || "parser";
    const rateLimitCheck = checkRateLimit(clientId);
    if (!rateLimitCheck.allowed) {
      console.warn(`🚫 Rate limit exceeded for client: ${clientId}`);
      return json({
        error: "Too Many Requests - Rate limit exceeded",
        retryAfter: rateLimitCheck.retryAfter
      }, 429, req, {
        "Retry-After": String(rateLimitCheck.retryAfter || 60)
      });
    }
    if (!supabase || !AI_API_KEY) {
      return json({
        error: "Server not configured"
      }, 500, req);
    }
    const body = await req.json().catch(()=>({}));
    const text = asStr(body.text);
    const channel = asStr(body.channel);
    const keyword = asStr(body.keyword);
    const has_image = Boolean(body.has_image);
    const timestamp = tsIso(body.timestamp);
    const messageLink = safeHttp(body.message_link);
    if (!text) throw new Error("text is required");
    // ОБРАБОТКА ТЕКСТА И HTML
    const extracted = extractInlineLinksToPlaceholders(text);
    let html = escapeHtml(extracted.text);
    html = html.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
    html = linkify(html);
    extracted.anchors.forEach((a, i)=>{
      html = html.replaceAll(`__A${i}__`, a);
    });
    html = highlight(html, keyword);
    const text_highlighted = html;
    // AI ОБРАБОТКА
    const aiRes = await openaiStrict({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: {
        type: "json_object"
      }
    });
    const parsed = JSON.parse(aiRes.choices?.[0]?.message?.content || "{}");
    let applyUrl = safeHttpOrTg(parsed?.apply_url) || extractApplyLinkFromText(text);
    if (applyUrl && !isTg(applyUrl) && isTelegramPostUrl(applyUrl)) applyUrl = "";
    let companyUrl = safeHttp(parsed?.company_url);
    if (!companyUrl) companyUrl = safeHttp(extractCompanyUrl(text, asStr(parsed?.company_name)));
    const row = {
      channel,
      keyword,
      timestamp,
      message_link: messageLink,
      has_image,
      text_highlighted,
      category: ((s)=>{
        const upper = s.toUpperCase();
        if (upper.includes("ТОЧН")) return "ТОЧНО ТВОЁ";
        if (upper.includes("МОЖЕТ")) return "МОЖЕТ БЫТЬ";
        return "НЕ ТВОЁ";
      })(asStr(parsed?.category)),
      reason: asStr(parsed?.reason),
      apply_url: applyUrl,
      skills: asArr(parsed?.skills),
      employment_type: asStr(parsed?.employment_type),
      work_format: asStr(parsed?.work_format),
      salary_display_text: asStr(parsed?.salary_display_text),
      industry: asStr(parsed?.industry),
      company_name: asStr(parsed?.company_name),
      company_url: companyUrl,
      status: "new"
    };
    // ПРОВЕРКА НА ДУБЛИКАТ
    if (row.message_link) {
      const { data: ex } = await supabase.from("vacancies").select("id").eq("message_link", row.message_link).limit(1).maybeSingle();
      if (ex?.id) {
        const { error } = await supabase.from("vacancies").update(row).eq("id", ex.id);
        if (error) throw error;
        return json({
          ok: true,
          id: ex.id
        }, 200, req);
      }
    }
    const { data: ins, error: insErr } = await supabase.from("vacancies").insert(row).select("id").single();
    if (insErr) throw insErr;
    return json({
      ok: true,
      id: ins.id
    }, 200, req);
  } catch (e) {
    console.error("❌ ai-vacancy-processor error:", e?.message || e);
    return json({
      ok: false,
      error: String(e?.message || e)
    }, 500, req);
  }
}, {
  onListen: ()=>console.log("✅ ai-vacancy-processor ready - Secret-based auth + AI processing + Rate limiting enabled")
});
