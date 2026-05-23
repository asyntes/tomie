import { Mood } from '../../types/mood';

export class MoodDetector {
  private static readonly VALID_MOODS: Mood[] = [
    'neutral', 'angry', 'romantic', 'excited', 'confused'
  ];

  private static readonly MOOD_TAG_PATTERN = /\[MOOD:\s*(\w+)\s*\]/gi;

  static extractMoodFromResponse(text: string): Mood {
    const matches = [...text.matchAll(this.MOOD_TAG_PATTERN)];
    if (matches.length === 0) {
      return 'neutral';
    }
    const lastMatch = matches[matches.length - 1];
    const raw = lastMatch[1]?.toLowerCase() as Mood;
    if (this.VALID_MOODS.includes(raw)) {
      return raw;
    }
    return 'neutral';
  }

  static cleanResponse(text: string): string {
    return text.replace(this.MOOD_TAG_PATTERN, '').replace(/\s+/g, ' ').trim();
  }
}
