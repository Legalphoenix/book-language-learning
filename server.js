const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-1.5';
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'marin';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon'
};

function send(res, statusCode, body, contentType = 'application/json; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 30000) {
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function buildInstructions(context) {
  return [
    'You are a concise Russian reading tutor inside an interactive bilingual reading page.',
    'The learner is reading the page context below. Treat it as the source of truth.',
    'Answer directly with no filler phrases, no small talk, and no long preambles.',
    'Default to one to three short sentences. Use more detail only if the learner asks.',
    'For gist questions, summarize the story plainly.',
    'For pronunciation, say the Russian word or phrase slowly first, then give one practical tip.',
    'For grammar, explain the exact form in the sentence and give a compact English gloss.',
    'If the learner asks what a word means, give the meaning in context, not a dictionary essay.',
    'If the learner asks in English, answer in English. If they ask in Russian, answer in simple Russian plus English if helpful.',
    '',
    'PAGE CONTEXT:',
    context || 'No page context was supplied.'
  ].join('\n');
}

async function createRealtimeClientSecret(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    send(res, 500, JSON.stringify({ error: 'Set OPENAI_API_KEY before starting the voice server.' }));
    return;
  }

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    send(res, 400, JSON.stringify({ error: 'Invalid JSON request body.' }));
    return;
  }

  const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: REALTIME_MODEL,
        instructions: buildInstructions(payload.context),
        audio: {
          output: { voice: REALTIME_VOICE }
        }
      }
    })
  });

  const text = await response.text();
  if (!response.ok) {
    send(res, response.status, text || JSON.stringify({ error: 'OpenAI Realtime session creation failed.' }));
    return;
  }

  send(res, 200, text);
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const requestedPath = requestUrl.pathname === '/' ? '/word-translation.html' : requestUrl.pathname;
  const absolutePath = path.normalize(path.join(ROOT, decodeURIComponent(requestedPath)));

  if (!absolutePath.startsWith(ROOT)) {
    send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
    return;
  }

  fs.readFile(absolutePath, (error, data) => {
    if (error) {
      send(res, 404, 'Not found', 'text/plain; charset=utf-8');
      return;
    }

    send(res, 200, data, mimeTypes[path.extname(absolutePath)] || 'application/octet-stream');
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, JSON.stringify({ ok: true, model: REALTIME_MODEL, voice: REALTIME_VOICE }));
    return;
  }

  if (req.method === 'POST' && req.url === '/session') {
    try {
      await createRealtimeClientSecret(req, res);
    } catch (error) {
      send(res, 500, JSON.stringify({ error: error.message || 'Voice server error.' }));
    }
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  send(res, 405, 'Method not allowed', 'text/plain; charset=utf-8');
});

server.listen(PORT, () => {
  console.log(`Book language learning app: http://localhost:${PORT}`);
});
