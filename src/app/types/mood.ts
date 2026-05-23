export type Mood = 'neutral' | 'angry' | 'romantic' | 'excited' | 'confused';

export interface MoodColors {
    primary: string;
    secondary: string;
    bg: string;
    border: string;
}

export interface MoodScore {
    mood: Mood;
    count: number;
}

export type MoodPhase = 'stable' | 'approaching' | 'cooling';

export interface MoodState {
    currentMood: Mood;
    scores: Record<Mood, number>;
    lastDetectedMood: Mood;
    phase: MoodPhase;
    pendingMood?: Mood;
    progressScore: number;
}