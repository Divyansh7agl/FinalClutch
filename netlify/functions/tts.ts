import ttsHandler from '../../api/tts.ts';

export const config = {
  path: '/api/tts'
};

export default async (req: Request) => {
  let body: any = {};
  const contentType = req.headers.get('content-type') || '';
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      if (contentType.includes('application/json')) {
        body = await req.json();
      } else {
        body = await req.text();
      }
    } catch {
      body = {};
    }
  }

  const headers: Record<string, string> = {};
  req.headers.forEach((val, key) => {
    headers[key.toLowerCase()] = val;
  });

  const mockReq: any = {
    method: req.method,
    headers,
    body,
    socket: { remoteAddress: req.headers.get('x-forwarded-for') || req.headers.get('client-ip') || '127.0.0.1' }
  };

  let statusCode = 200;
  const resHeaders = new Headers();
  let resBody = '';

  const mockRes: any = {
    statusCode: 200,
    setHeader(key: string, value: string) {
      resHeaders.set(key, value);
    },
    status(code: number) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.setHeader('Content-Type', 'application/json');
      resBody = JSON.stringify(data);
    },
    end(data?: string) {
      if (data) resBody = data;
    }
  };

  try {
    await ttsHandler(mockReq, mockRes);
  } catch (err: any) {
    console.error('[Netlify Function Error]', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (mockRes.statusCode) statusCode = mockRes.statusCode;

  return new Response(resBody, {
    status: statusCode,
    headers: resHeaders
  });
};
