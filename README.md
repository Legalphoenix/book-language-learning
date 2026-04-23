# Book Language Learning

Interactive bilingual Russian reading page with word translations, sentence audio, hidden illustrations, and an OpenAI Realtime voice tutor.

## Run Locally

```bash
export OPENAI_API_KEY="your_api_key"
npm start
```

Then open:

```text
http://localhost:8787
```

The voice tutor uses `gpt-realtime-1.5` by default and gets the full sentence list as session context. You can override the model or voice:

```bash
OPENAI_REALTIME_MODEL=gpt-realtime-1.5 OPENAI_REALTIME_VOICE=marin npm start
```
