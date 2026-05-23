import { describe, it, expect } from 'vitest';
import { MoodDetector } from '../moodDetector';

describe('MoodDetector', () => {
  it('extracts last valid mood tag', () => {
    const text = 'Hello [MOOD:angry] world [MOOD:neutral]';
    expect(MoodDetector.extractMoodFromResponse(text)).toBe('neutral');
  });

  it('handles whitespace in tags', () => {
    expect(MoodDetector.extractMoodFromResponse('Hi [MOOD: romantic ]')).toBe('romantic');
  });

  it('cleans all mood tags', () => {
    expect(MoodDetector.cleanResponse('Hi [MOOD:angry] there')).toBe('Hi there');
  });

  it('returns neutral when tag missing', () => {
    expect(MoodDetector.extractMoodFromResponse('No tag here')).toBe('neutral');
  });

  it('ignores invalid mood in tag', () => {
    expect(MoodDetector.extractMoodFromResponse('[MOOD:happy]')).toBe('neutral');
  });
});
