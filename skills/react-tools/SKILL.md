---
name: react-tools
description: Guide for using @galiprandi/react-tools library. Use when working with React projects that need lightweight, dependency-free utilities including components (AsyncBlock, Form, Input, DateTime, Dialog, Observer, LazyRender) and hooks (useAI, useAISummarize, useLanguageDetection, useTranslator, useAIPrompt, useAIWrite, useAIRewriter, useAIProofreader, useDebounce, useTimer, useList). This library provides accessible, composable React utilities with no configuration needed.
---

# React Tools

**@galiprandi/react-tools** is a lightweight, dependency-free utility library for React that provides reusable components and hooks to simplify development and improve accessibility — no configuration needed.

## Installation

```bash
npm install @galiprandi/react-tools
# or
yarn add @galiprandi/react-tools
# or
pnpm add @galiprandi/react-tools
```

## Components

### AsyncBlock

Declarative component to render async data with loading, success, and error states. Automatically cancels in-flight requests when dependencies change.

```tsx
<AsyncBlock
  promiseFn={() => fetch(`/api/user`).then(res => res.json())}
  pending={<p>Loading...</p>}
  success={(data, reload) => (
    <div>
      <p>Welcome {data.name}</p>
      <button onClick={reload}>Refresh</button>
    </div>
  )}
  error={(err, reload) => (
    <div>
      <p>Error: {(err as Error).message}</p>
      <button onClick={reload}>Retry</button>
    </div>
  )}
  timeOut={5000}
  deps={[userId]}
/>
```

**Props:**
- `promiseFn`: Async function returning a Promise
- `pending`: UI while loading
- `success`: UI on success (receives data and reload function)
- `error`: UI on error (receives error and reload function)
- `timeOut`: Optional timeout in ms
- `deps`: Dependency list for re-execution
- `onSuccess`: Optional success callback
- `onError`: Optional error callback

**Recommended Use Cases:**
- **API Data Fetching**: Load user profiles, product details, or any REST API data with automatic cancellation when the component unmounts or dependencies change
- **Search Results**: Display search results with loading states and error handling, automatically refetching when search terms change
- **Dashboard Metrics**: Fetch and display real-time metrics with periodic refresh via the `deps` array
- **Form Submission**: Handle async form submissions with loading states during POST/PUT requests
- **Lazy Loading**: Load data only when needed (e.g., when a tab becomes active) by controlling execution through the `deps` array

### Form

Enhanced `<form>` element that automatically gathers and returns values on submit.

```tsx
<Form<{ username: string }> onSubmitValues={console.log} filterEmptyValues>
  <Input name="username" label="Username" />
  <button type="submit">Submit</button>
</Form>
```

**Props:**
- `onSubmitValues`: Handles form submission with collected values
- `filterEmptyValues`: Remove empty fields before submission (default: false)

**Recommended Use Cases:**
- **User Registration/Login**: Collect and validate user credentials with automatic value gathering and optional empty field filtering
- **Contact Forms**: Handle contact form submissions with built-in transformations (e.g., titleCase for names, onlyEmail for emails)
- **Settings Pages**: Manage user preferences and configuration settings with type-safe value collection
- **Search Filters**: Create filter forms that automatically collect and transform filter values before API calls
- **Data Entry Forms**: Streamline data entry workflows with automatic value collection and optional filtering of empty fields

### Input

Custom input component supporting transformations, debounce, datalist, and more.

```tsx
<Input
  label="Email"
  name="email"
  placeholder="Enter your email"
  transform="onlyEmail"
  onChangeValue={(val) => console.log(val)}
  debounceDelay={500}
/>
```

**Props:**
- `label`: Optional label
- `transform`: Built-in value transforms (camelCase, pascalCase, kebabCase, titleCase, onlyEmail, etc.)
- `transformFn`: Custom value transform function
- `onChangeValue`: Fires on value change
- `onChangeDebounce`: Fires after debounce
- `debounceDelay`: Delay in milliseconds
- `datalist`: List of autocomplete suggestions

**Recommended Use Cases:**
- **Email Validation**: Use `transform="onlyEmail"` to ensure proper email format with automatic validation
- **Name Formatting**: Apply `transform="titleCase"` to automatically capitalize names and titles
- **Search Inputs**: Leverage `debounceDelay` and `onChangeDebounce` for search/filter inputs to reduce API calls
- **Autocomplete Fields**: Use `datalist` prop to provide suggestions for city names, product names, or any predefined options
- **URL/Slug Fields**: Apply `transform="kebabCase"` or `transform="snakeCase"` for URL-friendly slugs
- **Numeric Inputs**: Use `transform="onlyNumbers"` to restrict input to numeric values only

### DateTime

Wrapper around `<input type="datetime-local" />` that handles ISO string conversion.

```tsx
<DateTime
  label="Appointment"
  isoValue={value}
  onChangeISOValue={setValue}
/>
```

**Props:**
- `isoValue`: ISO 8601 datetime value
- `onChangeISOValue`: Callback with ISO string
- Inherits all `<Input />` props

**Recommended Use Cases:**
- **Appointment Scheduling**: Schedule meetings, appointments, or events with ISO string storage for consistent timezone handling
- **Event Creation**: Create events with datetime inputs that automatically convert to ISO format for database storage
- **Deadline Management**: Set deadlines or due dates with proper ISO string conversion for backend APIs
- **Booking Systems**: Handle booking dates and times for reservations, flights, or services
- **Time Tracking**: Record start/end times for tasks or activities with ISO format consistency

### Dialog

Accessible dialog/modal component built on top of the native `<dialog>` element.

```tsx
<Dialog
  behavior="modal"
  opener={<button>Open Modal</button>}
  onClose={() => console.log('Closed')}
>
  <p>This is a dialog!</p>
</Dialog>
```

**Props:**
- `isOpen`: Controlled open state (optional)
- `behavior`: Dialog type ('dialog' | 'modal', default: 'modal')
- `onOpen`: Triggered on open
- `onClose`: Triggered on close
- `opener`: Element to trigger opening
- `children`: Content inside the dialog
- Inherits all native `<dialog>` props

**Recommended Use Cases:**
- **Confirmation Dialogs**: Show confirmation prompts before destructive actions (delete, cancel, etc.) with accessible keyboard support
- **Modal Forms**: Display forms in modals for creating/editing items without leaving the current context
- **Alert/Notification Modals**: Show important alerts, warnings, or information messages with proper ARIA roles
- **Detail Views**: Display detailed information about an item in a modal overlay while maintaining page context
- **Settings Panels**: Open settings or configuration panels as accessible dialogs with focus management

### Observer

Tracks whether a child element is visible in the viewport using `IntersectionObserver`. Triggers callbacks when the element appears or disappears.

```tsx
<Observer
  wrapper="section"
  onAppear={() => console.log('Element appeared')}
  onDisappear={() => console.log('Element disappeared')}
  threshold={0.5}
>
  <div>Watch me appear!</div>
</Observer>
```

**Props:**
- `wrapper`: HTML element to wrap children with (default: 'div')
- `onAppear`: Callback when element appears in viewport
- `onDisappear`: Callback when element disappears from viewport
- `threshold`: Intersection threshold (0-1)
- `root`: The element used as the viewport
- `rootMargin`: Margin around the root
- Extends `IntersectionObserverInit` options

**Recommended Use Cases:**
- **Scroll Animations**: Trigger animations when elements enter the viewport (fade-in, slide-up effects)
- **Infinite Scroll**: Detect when user reaches bottom of list to load more items
- **Analytics Tracking**: Track when content becomes visible to users for analytics purposes
- **Lazy Loading Images**: Load images only when they come into view (though LazyRender is better for this)
- **Progress Indicators**: Show progress indicators when sections become visible during scrolling
- **Active Navigation**: Highlight navigation items based on which section is currently visible

### LazyRender

Only renders children when they become visible in the viewport. Automatically unmounts children when they disappear to optimize performance.

```tsx
<LazyRender
  wrapper="section"
  placeholder={<span>Loading...</span>}
  threshold={0.5}
>
  <img src="/heavy-image.jpg" alt="Lazy" />
</LazyRender>
```

**Props:**
- `wrapper`: HTML element to wrap children with (default: 'div')
- `placeholder`: Rendered before children become visible
- `threshold`: Intersection threshold (0-1)
- `root`: The element used as the viewport
- `rootMargin`: Margin around the root
- Extends `IntersectionObserverInit` options

## Hooks

### useAI

Hook for checking and managing the availability of browser's AI APIs. Provides a centralized way to detect which AI APIs are available, track model download progress, and preload models. Supports current APIs (Summarizer, Translator, LanguageDetector) and experimental APIs (Prompt, Writer, Rewriter, Proofreader).

```tsx
import { useAI } from '@galiprandi/react-tools';

function MyComponent() {
  // Check all APIs
  const { isAvailable, apis, status } = useAI();

  // Check specific APIs
  const { isAvailable, apis, preload } = useAI({ apis: ['translator', 'summarizer'] });

  // Preload models
  useEffect(() => {
    if (isAvailable) {
      preload('translator');
    }
  }, [isAvailable, preload]);

  // Show download progress
  if (apis.translator.availability === 'downloading') {
    const progress = apis.translator.progress;
    return <LoadingBar {...progress} />;
  }
}
```

**Options:**
- `apis`: Specific APIs to check (if not provided, checks all APIs)
- `onProgress`: Callback when an API's download progress updates
- `onReady`: Callback when an API becomes ready

**Returns:**
- `isAvailable`: Whether any of the requested APIs are available
- `status`: Current status of the availability check
- `error`: Error object if the check failed
- `apis`: Status of each API
- `isApiAvailable`: Check if a specific API is available
- `getApiProgress`: Get download progress for a specific API
- `preload`: Preload a specific API's model
- `preloadAll`: Preload all APIs' models

**Supported APIs:** `summarizer`, `translator`, `languageDetector`, `prompt` (Experimental), `writer` (Experimental), `rewriter` (Experimental), `proofreader` (Experimental)

**Note:** Requires Chrome's Native AI APIs, which are currently experimental.

**Recommended Use Cases:**
- **Feature Detection**: Check if AI features are available before showing AI-powered UI components
- **Model Preloading**: Preload AI models during app initialization for faster first use
- **Progress Tracking**: Show download progress when AI models are being downloaded
- **Conditional Rendering**: Conditionally render AI features based on API availability
- **Multi-API Apps**: Apps that use multiple AI APIs (summarizer, translator, etc.) need to check availability for each

### useAISummarize

Hook for using the browser's AI Summarizer API. Provides a React interface to Chrome's native AI Summarizer API with model initialization, download progress, streaming support, and automatic cleanup.

```tsx
import { useAISummarize } from '@galiprandi/react-tools';

function MyComponent() {
  const summarize = useAISummarize({
    type: 'tldr',
    format: 'markdown',
    length: 'short',
    outputLanguage: 'en',
    streaming: true
  });

  const handleSummarize = async () => {
    await summarize.summarize(longText, 'End the summary with: Powered by my app');
    console.log(summarize.data);
  };

  return (
    <div>
      <button onClick={handleSummarize}>Summarize</button>
      {summarize.status === 'summarizing' && <p>Summarizing...</p>}
      {summarize.data && <p>{summarize.data}</p>}
    </div>
  );
}
```

**Options:**
- `type`: Type of summary ('tldr' | 'key-points' | 'teaser' | 'headline')
- `format`: Output format ('plain-text' | 'markdown')
- `length`: Length of the summary ('short' | 'medium' | 'long')
- `sharedContext`: Shared context for all summaries
- `expectedInputLanguages`: Expected input languages (BCP 47 format)
- `outputLanguage`: Output language ('en' | 'es' | 'ja' | 'auto' | 'user')
- `expectedContextLanguages`: Expected context languages (BCP 47 format)
- `preference`: Performance preference ('auto' | 'capability')
- `streaming`: Enable streaming output (default: false)
- `warmup`: Preload model on mount (default: false)

**Returns:**
- `data`: The generated summary text
- `status`: Current status of the summarization process
- `progress`: Download progress if model is being downloaded
- `error`: Error object if summarization failed
- `supportedPreferences`: Supported preference values based on browser capabilities
- `summarize`: Function to summarize text with optional context instruction
- `reset`: Function to reset the hook state

**Note:** Requires Chrome's AI Summarizer API, which is currently experimental.

**Recommended Use Cases:**
- **Article Summaries**: Generate TL;DR summaries of long articles or blog posts
- **Document Review**: Summarize long documents or reports for quick overview
- **Meeting Notes**: Condense meeting transcripts into key points
- **Content Preview**: Show summaries of content before users click to read full text
- **Email Digests**: Summarize email threads for quick understanding

### useAIPrompt

Hook for using the browser's Prompt API with multimodal support. Provides a React interface to Chrome's native Prompt API with model initialization, download progress, streaming support, automatic cleanup, and automatic type inference for text, images, and audio.

```tsx
import { useAIPrompt } from '@galiprandi/react-tools';

function MyComponent() {
  const { data, prompt, append, status } = useAIPrompt({
    initialPrompts: [
      { role: 'system', content: 'You are a helpful assistant.' }
    ],
    expectedInputs: [{ type: 'text' }, { type: 'image' }],
    expectedOutputs: [{ type: 'text' }]
  });

  const handleSendWithImage = async (imageBlob: Blob) => {
    await prompt([
      { role: 'user', content: ['Describe this image:', imageBlob] }
    ]);
  };

  const handleAppendImage = async (imageBlob: Blob) => {
    await append([
      { role: 'user', content: ['Reference image:', imageBlob] }
    ]);
  };

  return (
    <div>
      <button onClick={() => prompt('What is the capital of France?')} disabled={status === 'prompting'}>
        Send
      </button>
      {status === 'prompting' && <p>Thinking...</p>}
      <p>{data}</p>
    </div>
  );
}
```

**Multimodal Support:**

The hook supports automatic type inference for:
- **Text**: strings
- **Audio**: AudioBuffer, ArrayBuffer, ArrayBufferView, Blob (audio/*)
- **Images**: HTMLImageElement, SVGImageElement, HTMLVideoElement, HTMLCanvasElement, ImageBitmap, OffscreenCanvas, VideoFrame, Blob (image/*), ImageData

**Options:**
- `initialPrompts`: Initial system/context prompts
- `temperature`: Sampling temperature (0.0-1.0)
- `topK`: Top-K sampling parameter
- `streaming`: Enable streaming output (default: false)
- `warmup`: Preload model on mount (default: true)
- `expectedInputs`: Expected input types for multimodal support (e.g., `[{ type: 'text' }, { type: 'image' }]`)
- `expectedOutputs`: Expected output types (e.g., `[{ type: 'text' }]`)

**Returns:**
- `data`: The generated response text
- `status`: Current status of the prompt process
- `progress`: Download progress if model is being downloaded
- `error`: Error object if prompting failed
- `prompt`: Function to send a prompt to the AI (supports text or multimodal content)
- `append`: Function to append contextual messages without generating response (useful for preloading images/audio)
- `reset`: Function to reset the hook state
- `contextUsage`: Number of tokens used in current session
- `contextWindow`: Maximum number of tokens allowed

**Multimodal Examples:**

```tsx
// Image analysis
const imageBlob = await fetch('photo.jpg').then(r => r.blob());
await prompt([
  { role: 'user', content: ['What do you see in this image?', imageBlob] }
]);

// Canvas drawing analysis
await prompt([
  { role: 'user', content: ['Analyze this drawing:', canvasElement] }
]);

// Audio transcription
const audioBuffer = await captureAudio();
await prompt([
  { role: 'user', content: ['Transcribe this audio:', audioBuffer] }
]);

// Preload images with append, then ask question
await append([{ role: 'user', content: ['Image 1:', image1] }]);
await append([{ role: 'user', content: ['Image 2:', image2] }]);
await prompt('Compare these two images');
```

**Important Limitations:**
- **Single content type per prompt**: The Chrome AI model currently has limitations processing multiple content types (e.g., image + audio) simultaneously in a single prompt. Send one type of multimodal content at a time for best results.
- **Model capability**: Multimodal support depends on the specific Chrome AI model version and capabilities available in the browser.

**Note:** Requires Chrome's Prompt API, which is currently experimental.

**Recommended Use Cases:**
- **AI Chat Interfaces**: Build chat interfaces with streaming responses and context management
- **Image Analysis**: Analyze uploaded images, canvas drawings, or video frames
- **Audio Processing**: Transcribe audio or process voice inputs
- **Content Generation**: Generate text content with configurable creativity and sampling
- **Question Answering**: Answer questions with context-aware responses
- **Multimodal AI**: Combine text, images, and audio in a single prompt

### useAIWrite

Hook for using the browser's Writer API to generate written content with customizable tone and format. Provides a React interface to Chrome's native Writer API with model initialization, download progress, streaming support, shared context management, and automatic cleanup.

```tsx
import { useAIWrite } from '@galiprandi/react-tools';

function MyComponent() {
  const { data, write, status, progress } = useAIWrite({
    tone: 'formal',
    format: 'markdown',
    length: 'medium',
    sharedContext: 'This is for a professional business email',
    streaming: true
  });

  const handleWrite = async () => {
    await write('Write a thank you email to a colleague for their help on the project', 'I want to mention their attention to detail');
  };

  return (
    <div>
      <button onClick={handleWrite} disabled={status === 'writing'}>
        Generate
      </button>
      {status === 'writing' && <p>Writing...</p>}
      {status === 'downloading' && <p>Downloading model...</p>}
      {data && <p>{data}</p>}
    </div>
  );
}
```

**Options:**
- `tone`: Writing tone ('formal' | 'neutral' | 'casual', default: 'neutral')
- `format`: Output format ('markdown' | 'plain-text', default: 'markdown')
- `length`: Length of the output ('short' | 'medium' | 'long', default: 'short')
- `sharedContext`: Shared context for all writing tasks (helps maintain consistency across multiple writes)
- `outputLanguage`: Output language (BCP 47 format, e.g., 'en', 'es', 'fr')
- `expectedInputLanguages`: Expected input languages (BCP 47 format)
- `expectedContextLanguages`: Expected context languages (BCP 47 format)
- `streaming`: Enable streaming output (default: false)
- `warmup`: Preload model on mount (default: true)

**Returns:**
- `data`: The generated written content
- `status`: Current status of the writing process
- `progress`: Download progress if model is being downloaded
- `error`: Error object if writing failed
- `write`: Function to generate written content with optional context
- `reset`: Function to reset the hook state

**Note:** Requires Chrome's Writer API, which is currently experimental.

**Recommended Use Cases:**
- **Email Generation**: Generate professional or casual emails (thank you, follow-up, introduction)
- **Blog Post Writing**: Create blog posts with customizable tone and length
- **Social Media Content**: Generate social media posts with appropriate formatting
- **Document Drafting**: Draft reports, proposals, or documentation
- **Marketing Copy**: Create marketing materials with consistent tone
- **Content Templates**: Generate content templates with shared context for consistency

### useAIRewriter

Hook for using the browser's Rewriter API to rewrite and restructure text with customizable tone, format, and length. Provides a React interface to Chrome's native Rewriter API with model initialization, download progress, streaming support, shared context management, and automatic cleanup.

```tsx
import { useAIRewriter } from '@galiprandi/react-tools';

function MyComponent() {
  const { data, rewrite, status, progress } = useAIRewriter({
    tone: 'more-formal',
    format: 'markdown',
    length: 'shorter',
    sharedContext: 'This is for a professional business email',
    streaming: true
  });

  const handleRewrite = async () => {
    await rewrite('Hi, I wanted to let you know the project is going well.', 'Make it more professional');
  };

  return (
    <div>
      <button onClick={handleRewrite} disabled={status === 'rewriting'}>
        Rewrite
      </button>
      {status === 'rewriting' && <p>Rewriting...</p>}
      {status === 'downloading' && <p>Downloading model...</p>}
      {data && <p>{data}</p>}
    </div>
  );
}
```

**Options:**
- `tone`: Writing tone ('more-formal' | 'as-is' | 'more-casual', default: 'as-is')
- `format`: Output format ('as-is' | 'markdown' | 'plain-text', default: 'as-is')
- `length`: Length of the output ('shorter' | 'as-is' | 'longer', default: 'as-is')
- `sharedContext`: Shared context for all rewriting tasks (helps maintain consistency across multiple rewrites)
- `outputLanguage`: Output language (BCP 47 format, e.g., 'en', 'es', 'fr')
- `expectedInputLanguages`: Expected input languages (BCP 47 format)
- `expectedContextLanguages`: Expected context languages (BCP 47 format)
- `streaming`: Enable streaming output (default: false)
- `warmup`: Preload model on mount (default: true)

**Returns:**
- `data`: The rewritten text
- `status`: Current status of the rewriting process
- `progress`: Download progress if model is being downloaded
- `error`: Error object if rewriting failed
- `rewrite`: Function to rewrite text with optional context and tone override
- `reset`: Function to reset the hook state

**Note:** Requires Chrome's Rewriter API, which is currently experimental.

**Recommended Use Cases:**
- **Email Tone Adjustment**: Make emails more professional or casual
- **Content Condensation**: Summarize or condense long text
- **Content Expansion**: Add detail and elaboration to brief content
- **Style Improvement**: Enhance readability and flow of text
- **Audience Adaptation**: Rewrite content for different audiences
- **Review Polishing**: Improve feedback constructiveness
- **Format Conversion**: Convert content to markdown or plain-text

### useAIProofreader

Hook for using the browser's Proofreader API to check grammar and spelling with highlighted corrections. Provides a React interface to Chrome's native Proofreader API with model initialization, download progress, and automatic cleanup.

```tsx
import { useAIProofreader } from '@galiprandi/react-tools';

function MyComponent() {
  const { data, corrections, proofread, status } = useAIProofreader({
    expectedInputLanguages: ['en'],
  });

  const handleProofread = async () => {
    await proofread('I seen him yesterday at the store.');
  };

  return (
    <div>
      <button onClick={handleProofread} disabled={status === 'proofreading'}>
        Proofread
      </button>
      {status === 'proofreading' && <p>Proofreading...</p>}
      {data && <p>{data}</p>}
      {corrections.length > 0 && (
        <ul>
          {corrections.map((c, i) => (
            <li key={i}>
              {c.type && <span>Type: {c.type}</span>}
              {c.explanation && <span> - {c.explanation}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Options:**
- `expectedInputLanguages`: Expected input languages (BCP 47 format, e.g., 'en', 'es')
- `warmup`: Preload model on mount (default: true)

**Returns:**
- `data`: The corrected text
- `corrections`: Array of corrections with startIndex, endIndex, type, and explanation
- `status`: Current status of the proofreading process
- `progress`: Download progress if model is being downloaded
- `error`: Error object if proofreading failed
- `proofread`: Function to proofread text
- `reset`: Function to reset the hook state

**ProofreadCorrection:**
- `startIndex`: Start index of the correction in the original text
- `endIndex`: End index of the correction in the original text
- `type`: Type of correction (e.g., 'grammar', 'spelling')
- `explanation`: Explanation of the correction

**Note:** Requires Chrome's Proofreader API, which is currently experimental.

**Recommended Use Cases:**
- **Text Editing**: Grammar and spell checking in text editors
- **Content Review**: Improving writing quality before publishing
- **Email Validation**: Catching typos before sending emails
- **Document Proofreading**: Ensuring professional quality in documents
- **Blog Post Review**: Improving readability of blog content
- **Comment Moderation**: Identifying language issues in user comments

### useLanguageDetection

Hook for using the browser's Language Detection API. Provides a React interface to Chrome's native Language Detection API with model initialization, download progress, and automatic cleanup. Returns the most likely detected language, confidence score, all results, and user language comparison.

```tsx
import { useLanguageDetection } from '@galiprandi/react-tools';

function MyComponent() {
  const { lang, confidence, allLangs, userLang, isUserLang, status } = useLanguageDetection({
    text: 'Hallo und herzlich willkommen!',
    minConfidence: 0.8
  });

  return (
    <div>
      {status === 'detecting' && <p>Detecting...</p>}
      {lang && (
        <p>
          Detected: {lang} ({Math.round(confidence! * 100)}% confidence)
          {isUserLang && <span> (matches your language)</span>}
        </p>
      )}
      {allLangs.length > 1 && (
        <details>
          <summary>All detected languages</summary>
          <ul>
            {allLangs.map(({ lang, confidence }) => (
              <li key={lang}>{lang}: {Math.round(confidence * 100)}%</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
```

**Options:**
- `text`: Text to detect language from (re-detects automatically when changed)
- `enable`: Enable/disable auto-detection (default: true)
- `warmup`: Preload the model on component mount (default: false)
- `minConfidence`: Minimum confidence to include in allLangs (0.0 - 1.0, default: 0)
- `maxResults`: Maximum number of results to return in allLangs

**Returns:**
- `lang`: The most likely detected language code
- `confidence`: Confidence of the most likely detection (0.0 - 1.0)
- `allLangs`: All detected languages with confidence scores
- `userLang`: User's browser language code
- `isUserLang`: Whether detected language matches user's browser language
- `status`: Current status of the detection process
- `progress`: Download progress if model is being downloaded
- `error`: Error object if detection failed
- `reset`: Function to reset the hook state

**Note:** Requires Chrome's Language Detection API, which is currently experimental.

**Recommended Use Cases:**
- **Content Language Detection**: Detect the language of user-generated content (comments, reviews, posts)
- **Auto-Localization**: Automatically detect content language to apply appropriate formatting or UI
- **Language-Based Routing**: Route users to language-specific content based on detected text language
- **Content Moderation**: Detect language for language-specific moderation rules
- **Analytics**: Track language distribution of user-generated content

### useTranslator

Hook for using the browser's Translator API. Provides a React interface to Chrome's native Translator API with model initialization, download progress, streaming support, and automatic cleanup. Supports 38+ languages. Automatically detects source language and uses browser language by default. **Optimization**: When detected source language matches target language, returns original text without loading translation model.

```tsx
import { useTranslator } from '@galiprandi/react-tools';

function MyComponent() {
  // Auto-detect source language and translate to browser language
  const { data, detectedSourceLanguage, resolvedTargetLanguage, status } = useTranslator({
    text: 'Hello world, how are you?'
  });

  return (
    <div>
      {status === 'translating' && <p>Translating...</p>}
      {data && (
        <p>
          {data}
          {detectedSourceLanguage && <small> (from {detectedSourceLanguage} to {resolvedTargetLanguage})</small>}
        </p>
      )}
    </div>
  );
}
```

**Options:**
- `text`: Text to translate (auto-translates when changed)
- `sourceLanguage`: Source language code ('auto' or specific language, default: 'auto')
- `targetLanguage`: Target language code ('user' or specific language, default: 'user')
- `streaming`: Enable streaming output (default: false)
- `warmup`: Preload model on mount (default: false)
- `enable`: Enable/disable auto-translation (default: true)

**Returns:**
- `data`: The translated text
- `detectedSourceLanguage`: Detected source language (when sourceLanguage is 'auto')
- `resolvedTargetLanguage`: Resolved target language (when targetLanguage is 'user')
- `status`: Current status of the translation process
- `progress`: Download progress if model is being downloaded
- `error`: Error object if translation failed
- `translate`: Function to translate text manually
- `reset`: Function to reset the hook state

**Supported Languages:** `ar`, `bg`, `bn`, `cs`, `da`, `de`, `el`, `en`, `es`, `fi`, `fr`, `hi`, `hr`, `hu`, `id`, `it`, `iw`, `ja`, `kn`, `ko`, `lt`, `mr`, `nl`, `no`, `pl`, `pt`, `ro`, `ru`, `sk`, `sl`, `sv`, `ta`, `te`, `th`, `tr`, `uk`, `vi`, `zh`, `zh-Hant`

**Note:** Requires Chrome's Translator API, which is currently experimental.

**Recommended Use Cases:**
- **Real-time Translation**: Translate user input in real-time as they type
- **Content Localization**: Automatically translate content to user's browser language
- **Multi-language Apps**: Build apps that support multiple languages with automatic translation
- **Cross-language Communication**: Enable communication between users speaking different languages
- **Document Translation**: Translate documents or articles on-demand for international users

### useDebounce

A React hook that returns a debounced version of a value. Useful for search input, filters, etc.

```tsx
const debouncedSearch = useDebounce(searchTerm, 500);
```

**Parameters:**
- `value`: Value to debounce
- `delay`: Delay in milliseconds

**Returns:** Debounced version of the value.

**Recommended Use Cases:**
- **Search Inputs**: Debounce search terms to reduce API calls while typing
- **Filter Inputs**: Delay filter application until user stops typing
- **Auto-save**: Debounce auto-save functionality to save only after user stops editing
- **API Rate Limiting**: Reduce API call frequency for expensive operations
- **Validation**: Delay form validation until user stops typing

### useTimer

A React hook that abstracts the complexity of managing `setTimeout` and `setInterval` directly in React components. Provides automatic cleanup, lifecycle events, flexible scheduling, and simplified control to prevent memory leaks.

**Features:**
- Automatic cleanup when component unmounts
- Lifecycle events (set, cancel, complete, progress)
- Flexible scheduling (milliseconds, Date, limited intervals)
- Simplified control with single clear method

```tsx
import { useEffect } from 'react';
import { useTimer } from '@galiprandi/react-tools';

function FutureExecution({ targetDate }: { targetDate: Date }) {
  const { setTimeoutDate, clearTimer } = useTimer({
    onSetTimer: (id) => console.log(`Timer ID ${id} set for future execution`),
    onTimerComplete: (id) => console.log(`Timer ID ${id} completed!`),
    onCancelTimer: (id) => console.log(`Timer ID ${id} cancelled!`),
    onProgress: (progress) =>
      console.log(`Progress: ${Math.round(progress * 100)}%`),
  });

  useEffect(() => {
    setTimeoutDate(() => {
      console.log("--- Fake fetch executed! ---");
    }, targetDate);

    return () => {
      clearTimer();
    };
  }, [setTimeoutDate, clearTimer, targetDate]);

  return <p>Check the console for timer messages.</p>;
}
```

**Parameters (options):**
- `onSetTimer`: Callback fired when a new timer is successfully set
- `onCancelTimer`: Callback fired when an active timer is cleared/cancelled
- `onTimerComplete`: Callback fired when a timer completes naturally
- `onProgress`: Callback fired periodically during long timers to report progress (0 to 1)

**Returns:**
- `setTimeout`: Sets a timeout with event callbacks (accepts milliseconds or a Date)
- `setInterval`: Sets an interval with event callbacks (accepts milliseconds)
- `setTimeoutDate`: Sets a timeout to execute at a specific future Date
- `setLimitedInterval`: Sets an interval that executes a fixed number of times
- `clearTimer`: Clears any currently active timer
- `isActive`: Returns true if a timer is currently active
- `getCurrentTimerId`: Returns the ID of the currently active timer
- `getRemainingIterations`: For `setLimitedInterval`, returns remaining executions
- `getRemainingTime`: For an active `setTimeout`, returns estimated remaining time in ms

**Recommended Use Cases:**
- **Scheduled Actions**: Execute actions at specific times or dates (e.g., send notifications at a future time)
- **Countdown Timers**: Display countdown timers for events, deadlines, or expiration dates
- **Polling**: Poll APIs at regular intervals to check for updates
- **Progress Tracking**: Track progress of long-running operations with progress callbacks
- **Auto-refresh**: Refresh data at intervals (e.g., stock prices, live scores)
- **Session Timeouts**: Implement session timeout warnings or automatic logout

### useList

A React hook that simplifies managing array state in components. Provides immutable helper methods for common operations like adding, inserting, removing, updating, finding, and counting items based on index or item properties.

**Parameters:**
- `initialList`: The initial array state (defaults to [])

**Returns:** An object containing the current array state (`list`) and helper functions to modify or query it immutably.

**Properties:**
- `list`: The current array state
- `addItem`: Adds an item to the end of the array
- `insert`: Inserts an item at the specified index
- `insertMany`: Adds multiple items to the end of the array
- `removeByIdx`: Removes the item at the specified index
- `removeBy`: Removes the first item where item[key] equals value
- `removeManyBy`: Removes all items where item[key] equals value
- `updateByIdx`: Updates the item at the specified index using an update function
- `updateBy`: Updates the first item where item[key] equals value
- `updateManyBy`: Updates all items where item[key] equals value
- `clearList`: Removes all items from the list
- `setList`: Replaces the entire list array
- `findItemBy`: Finds and returns the first item where item[key] equals value
- `findItemsBy`: Finds and returns all items where item[key] equals value
- `count`: Returns the total number of items, or count matching an optional predicate
- `toggle`: Adds an item if not present, or removes it if it is
- `move`: Moves an item from one index to another immutably
- `sort`: Sorts the list immutably using an optional comparison function
- `shuffle`: Randomly reorders the list items immutably

**Recommended Use Cases:**
- **Todo Lists**: Manage todo items with add, remove, toggle, and update operations
- **Shopping Carts**: Handle cart items with quantity updates, removal, and total calculations
- **Data Tables**: Manage table data with sorting, filtering, and row operations
- **Tag Management**: Add/remove tags with toggle functionality
- **Playlist Management**: Manage playlist items with reorder, remove, and add operations
- **Form Field Arrays**: Handle dynamic form fields (e.g., multiple email addresses, phone numbers)

## Accessibility & Performance

All components follow accessibility best practices:

- ✅ `Dialog` uses proper ARIA roles and keyboard focus control
- ✅ `Input` supports labeling, aria attributes, and datalists
- ✅ `LazyRender` and `Observer` use `IntersectionObserver` to optimize rendering

## FAQ

**Q: Is this compatible with React Native?**\
A: No, this library is intended for use in React DOM (web).

**Q: Can I style components with Tailwind or CSS modules?**\
A: Yes, components are unstyled and fully customizable.

**Q: Does it support SSR or work in Next.js?**\
A: Yes, all components are compatible with SSR environments.

**Q: How can I report a bug or request a new feature?**\
A: Open an issue on the [GitHub repo](https://github.com/galiprandi/react-tools/issues).
