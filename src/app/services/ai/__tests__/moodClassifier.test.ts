import { describe, it, expect } from 'vitest';
import { parseClassifierMood } from '../moodClassifier';

describe('parseClassifierMood', () => {
    it('parses single word moods', () => {
        expect(parseClassifierMood('angry')).toBe('angry');
        expect(parseClassifierMood('Angry.')).toBe('angry');
        expect(parseClassifierMood('romantic\n')).toBe('romantic');
    });

    it('falls back to neutral for garbage', () => {
        expect(parseClassifierMood('maybe')).toBe('neutral');
    });
});
