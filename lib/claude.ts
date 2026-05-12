import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import type { Couplet } from '@/types';

const client = new Anthropic();

let _systemPrompt: string | null = null;
function systemPrompt(): string {
  if (!_systemPrompt) {
    _systemPrompt = fs.readFileSync(path.join(process.cwd(), 'system_prompt.md'), 'utf-8');
  }
  return _systemPrompt;
}

function text(msg: Anthropic.Message): string {
  return (msg.content[0] as { type: 'text'; text: string }).text.trim();
}

export async function draftCouplet(farsi: string, previousCouplets: Couplet[]): Promise<string> {
  const context = previousCouplets
    .slice(-3)
    .map((c, i) => `${i + 1}. ${c.farsi} → ${c.punjabi_final}`)
    .join('\n');

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content:
        `<context>\nprevious approved couplets in this section:\n${context || '(none yet)'}\n</context>\n\n` +
        `<task>\ntranslate the following farsi couplet into shahmukhi punjabi, following the philosophy and rules in the system prompt. output only the punjabi couplet, no explanation.\n\nfarsi: ${farsi}\n</task>`,
    }],
  });

  return text(msg);
}

export async function wordAlternatives(
  farsi: string,
  currentDraft: string,
  clickedWord: string,
): Promise<string[]> {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content:
        `<context>\nfarsi couplet: ${farsi}\ncurrent shahmukhi punjabi translation: ${currentDraft}\n` +
        `the user clicked on this word in the translation: ${clickedWord}\n</context>\n\n` +
        `<task>\nsuggest 3-5 alternative shahmukhi punjabi words for "${clickedWord}" that fit the verse's meaning and register. ` +
        `consider persian-rooted alternatives where appropriate. output as a JSON array of strings, nothing else.\n</task>`,
    }],
  });

  return JSON.parse(text(msg)) as string[];
}

export async function regenerateCouplet(
  farsi: string,
  draftWithEdits: string,
  romanInput: string,
): Promise<string> {
  const romanSection = romanInput.trim()
    ? `additional words/phrases i want to include (written in roman punjabi, please render properly in shahmukhi): ${romanInput}`
    : '(no additional roman input)';

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content:
        `<context>\nfarsi couplet: ${farsi}\ncurrent draft (with my edits applied): ${draftWithEdits}\n${romanSection}\n</context>\n\n` +
        `<task>\nproduce the final shahmukhi punjabi couplet integrating the existing draft and the roman input. ` +
        `preserve my word choices in the draft unless they are now grammatically broken. ` +
        `render the roman input into proper shahmukhi. output only the punjabi couplet, no explanation.\n</task>`,
    }],
  });

  return text(msg);
}
