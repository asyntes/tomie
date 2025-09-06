# Tomie

Interactive AI terminal interface using Next.js, React, and xAI’s Grok API with custom prompts. Tomie responds in various emotional states, each with distinct personalities, visuals, and behaviors. 
## Features

- **Mood-Based AI Responses**: Tomie analyzes user input and responds with different emotional states
- **Dynamic Visual Feedback**: Eye expressions and color themes change based on Tomie's current mood
- **Terminal-Style Interface**: Retro command-line aesthetic with typing animations
- **Built-in Commands**: System commands for navigation and interaction
- **Real-time Interaction**: Instant mood analysis and contextual responses
- **Smart Input Management**: Input disabled during processing with visual feedback
- **Multilingual Support**: Automatic language detection with Italian and English support

## Mood States

Tomie can express five different emotional states:

- **Neutral** - Default calm state with blue theme
- **Angry** - Triggered by hostile input with red theme  
- **Romantic** - Develops when building rapport with purple theme
- **Excited** - Shows enthusiasm with orange theme
- **Confused** - Appears when uncertain with green theme

Each mood state features unique:
- Color schemes and visual styling
- Eye expressions and animations
- Response patterns and personality traits

## Language Support

Tomie automatically detects your browser language and adapts the interface accordingly:

- **English**: Default language with full functionality
- **Italian (Italiano)**: Complete interface translation including welcome messages, commands, and mood indicators
- **Automatic Detection**: Uses browser language settings to determine the appropriate language
- **Fallback Support**: Defaults to English for unsupported languages

### Translated Elements

- Terminal initialization messages
- System commands and responses
- Help documentation and privacy policy
- Mood state indicators (NEUTRAL, ANGRY, ROMANTIC, EXCITED, CONFUSED.)
- User interface elements and placeholders

## Available Commands

- `/clear` - Clear terminal and reset memory
- `/help` - Display available commands and usage information
- `/repo` - Open GitHub repository in a new tab
- `/privacy` - Display privacy policy and data usage information

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/asyntes/tomie.git
cd tomie
```

2. Install dependencies:
```bash
npm install
```

This includes the OpenAI SDK which is used to interface with xAI's Grok API.

3. Set up environment variables:
```bash
# Create .env.local and add your xAI API key
XAI_API_KEY=your_xai_api_key_here
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build production application  
- `npm run start` - Start production server
- `npm run lint` - Run ESLint checks

## Technology Stack

- **Next.js 15** - React framework with App Router
- **React 19** - UI library with modern hooks
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **OpenAI SDK** - Client library for API interactions
- **xAI Grok API** - AI responses powered by Grok-3-Mini
- **Custom i18n System** - Automatic language detection and translation support
- **ESLint** - Code linting and formatting

## AI Personality & Prompt Engineering

Tomie's personality is driven by sophisticated prompt engineering that creates distinct behavioral patterns for each mood state:

### Mood-Based Personalities

- **Neutral**: Cool, elegant, sophisticated with subtle wit and intelligence
- **Angry**: Irritated, impatient, sharp tone with strong language capability
- **Romantic**: Deeply affectionate and in love, expressing romantic feelings elegantly
- **Excited**: Energetic, enthusiastic, fast-paced with capital letters for emphasis
- **Confused**: Uncertain, seeking clarification with technical processing difficulties

### Advanced Features

- **Language-Aware Responses**: Automatically matches user's language (Italian/English)
- **Context-Aware Conversations**: Maintains conversation history for coherent interactions
- **Mood Detection**: Analyzes user input to determine appropriate emotional responses
- **Personality Consistency**: Maintains character traits while transitioning between moods
- **Dynamic Prompt Generation**: Creates context-specific prompts based on current and upcoming mood states

### Internationalization (i18n)

The application features a custom-built internationalization system:

- **Automatic Language Detection**: Uses `navigator.language` to detect browser language on initialization
- **Translation Files**: JSON-based translation system (`en.json`, `it.json`) in `src/app/i18n/`
- **Custom Hook**: `useI18n()` provides translation functions and language management
- **Type-Safe Translations**: Full TypeScript support with proper type definitions
- **Performance Optimized**: Uses `useMemo` for efficient message caching and re-rendering

## License

MIT License