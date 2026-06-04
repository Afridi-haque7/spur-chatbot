// This file previously held the Anthropic provider. The app now uses Groq
// (see ./groq.ts). It's intentionally emptied so the build doesn't depend on
// @anthropic-ai/sdk, which has been removed from package.json.
//
// Safe to delete:  rm server/src/llm/anthropic.ts
export {};
