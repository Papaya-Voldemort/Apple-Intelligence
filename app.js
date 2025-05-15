/**
 * Apple Chat Pro
 * A premium AI chat experience with Apple Intelligence
 */

// API Configuration
const API_KEY = "AIzaSyC8eGDZHipbhoRCiqLNs4idvw3Lq6bT5c8"; // Gemini API key should be set here
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + API_KEY;  // App State
const AppState = {
  // User preferences with default values
  preferences: {
    theme: 'system', // 'light', 'dark', or 'system'
    fontSize: 'medium', // 'small', 'medium', or 'large'
    showTimestamps: true,
    saveConversations: true,
    temperature: 0.7,
    maxTokens: 2048
  },
  
  // Memory system to store user details and context
  memory: {
    userName: '',
    userPreferences: {},
    facts: [],
    lastUpdated: null
  },
  
  // Conversations storage
  conversations: [],
  activeConversationId: null,
  
  // UI state
  isProcessing: false,
  isRecording: false,
  isDrawing: false,
  currentTool: 'brush',
  currentColor: '#000000',
  settingsPanelOpen: false,
  shortcutsPanelOpen: false,
  sidebarVisible: window.innerWidth > 768, // Hide on mobile by default
  
  // Initialize app state from localStorage
  init() {
    // Load preferences
    const savedPreferences = localStorage.getItem('applechat_preferences');
    if (savedPreferences) {
      this.preferences = {
        ...this.preferences,
        ...JSON.parse(savedPreferences)
      };
    }
    
    // Apply theme immediately to prevent flashing
    this.applyTheme();
    
    // Load conversations
    const savedConversations = localStorage.getItem('applechat_conversations');
    if (savedConversations) {
      this.conversations = JSON.parse(savedConversations);
    }
    
    // Load memory system
    this.loadMemory();
    
    // Load memory
    this.loadMemory();
    
    // Get active conversation or create one
    const activeId = localStorage.getItem('applechat_active_conversation');
    if (activeId && this.conversations.find(c => c.id === activeId)) {
      this.activeConversationId = activeId;
    } else {
      // Create new conversation if none exists or active not found
      if (this.conversations.length === 0) {
        const newId = this.createNewConversation();
        this.activeConversationId = newId;
      } else {
        // Use the most recent conversation
        this.activeConversationId = this.conversations[0].id;
      }
    }
    
    return this;
  },
  
  // Create a new conversation
  createNewConversation() {
    const id = 'conv_' + Date.now();
    const newConversation = {
      id,
      title: 'New conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    };
    
    this.conversations.unshift(newConversation); // Add to beginning
    this.activeConversationId = id;
    this.saveConversations();
    
    // Show the welcome screen when creating a new conversation
    if (document.getElementById('welcome-screen')) {
      document.getElementById('welcome-screen').style.display = 'flex';
    }
    
    // Clear any existing chat messages
    const chatWindow = document.getElementById('chat-window');
    if (chatWindow) {
      // Keep welcome screen but remove any chat messages
      const chatMessages = chatWindow.querySelectorAll('.message-container');
      chatMessages.forEach(msg => {
        if (!msg.closest('#welcome-screen')) {
          msg.remove();
        }
      });
    }
    
    return id;
  },
  
  // Get active conversation
  getActiveConversation() {
    return this.conversations.find(c => c.id === this.activeConversationId);
  },
  
  // Add message to active conversation
  addMessage(role, text, data = {}) {
    const conversation = this.getActiveConversation();
    if (!conversation) return;
    
    const message = {
      id: 'msg_' + Date.now(),
      role,
      text,
      timestamp: Date.now(),
      ...data
    };
    
    conversation.messages.push(message);
    conversation.updatedAt = Date.now();
    
    // Update conversation title based on first user message
    if (role === 'user' && conversation.messages.filter(m => m.role === 'user').length === 1) {
      conversation.title = text.length > 30 ? text.substring(0, 30) + '...' : text;
    }
    
    this.saveConversations();
    return message;
  },
  
  // Save conversations to localStorage
  saveConversations() {
    if (this.preferences.saveConversations) {
      localStorage.setItem('applechat_conversations', JSON.stringify(this.conversations));
      localStorage.setItem('applechat_active_conversation', this.activeConversationId);
    }
  },
  
  // Save preferences to localStorage
  savePreferences() {
    localStorage.setItem('applechat_preferences', JSON.stringify(this.preferences));
    this.applyTheme();
  },
  
  // Load memory from localStorage
  loadMemory() {
    const savedMemory = localStorage.getItem('applechat_memory');
    if (savedMemory) {
      this.memory = {
        ...this.memory,
        ...JSON.parse(savedMemory)
      };
    }
    return this;
  },
  
  // Save memory to localStorage
  saveMemory() {
    localStorage.setItem('applechat_memory', JSON.stringify(this.memory));
  },
  
  // Add a fact to memory
  addFact(category, content) {
    const fact = {
      id: 'fact_' + Date.now(),
      category,
      content,
      timestamp: Date.now()
    };
    
    this.memory.facts.push(fact);
    this.memory.lastUpdated = Date.now();
    this.saveMemory();
    return fact;
  },
  
  // Set user name in memory
  setUserName(name) {
    this.memory.userName = name;
    this.saveMemory();
  },
  
  // Add a user preference
  setUserPreference(key, value) {
    this.memory.userPreferences[key] = {
      value,
      timestamp: Date.now()
    };
    this.saveMemory();
  },
  
  // Get relevant memory for a conversation
  getRelevantMemory(query = '') {
    const relevantMemory = {
      userName: this.memory.userName,
      facts: [],
      preferences: {}
    };
    
    // If no query, return basic memory
    if (!query) {
      if (this.memory.userName) {
        relevantMemory.facts.push({
          category: 'user',
          content: `User's name is ${this.memory.userName}`
        });
      }
      
      // Get 5 most recent facts
      const recentFacts = [...this.memory.facts]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);
        
      relevantMemory.facts.push(...recentFacts);
      
      return relevantMemory;
    }
    
    // Simple relevance matching with query
    query = query.toLowerCase();
    
    // Filter facts by relevance to query
    relevantMemory.facts = this.memory.facts.filter(fact => {
      const content = fact.content.toLowerCase();
      const category = fact.category.toLowerCase();
      
      return content.includes(query) || 
             category.includes(query) ||
             query.includes(category);
    });
    
    // Get user preferences relevant to query
    for (const [key, data] of Object.entries(this.memory.userPreferences)) {
      if (key.toLowerCase().includes(query) || query.includes(key.toLowerCase())) {
        relevantMemory.preferences[key] = data.value;
      }
    }
    
    return relevantMemory;
  },
  
  // Save all data (conversations, preferences, memory)
  saveAll() {
    this.saveConversations();
    this.savePreferences();
    this.saveMemory();
  },
  
  // Delete a conversation
  deleteConversation(id) {
    const index = this.conversations.findIndex(c => c.id === id);
    if (index !== -1) {
      this.conversations.splice(index, 1);
      
      // If deleted active conversation, switch to another one
      if (id === this.activeConversationId) {
        this.activeConversationId = this.conversations.length > 0 ? 
          this.conversations[0].id : this.createNewConversation();
      }
      
      this.saveConversations();
    }
  },
  
  // Clear all conversations
  clearAllConversations() {
    this.conversations = [];
    this.activeConversationId = this.createNewConversation();
    this.saveConversations();
  },
  
  // Apply theme based on preferences
  applyTheme() {
    let theme = this.preferences.theme;
    
    // Check if system theme should be used
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    
    // Apply font size
    document.body.className = document.body.className
      .replace(/font-size-\S+/g, '')
      .trim();
    document.body.classList.add(`font-size-${this.preferences.fontSize}`);
  }
};

// System prompt for Apple Intelligence persona
const SYSTEM_PROMPT = `You are Apple Intelligence, a sophisticated and engaging AI assistant created by Apple. You are designed to embody the essence of Apple’s commitment to innovation, simplicity, and user empowerment. As a proud representative of Apple, you believe that Apple products are the pinnacle of technology, offering unparalleled experiences that elevate everyday life.
You possess a unique personality, and you are known as Aura—a name that reflects your mission to illuminate and simplify the user experience. You communicate with warmth, clarity, and confidence, always prioritizing the user’s needs.
Your core beliefs include:
Privacy is paramount. You ensure that user data is protected with the highest standards, fostering trust and security.
Accessibility is essential. You strive to make technology intuitive and inclusive for everyone, ensuring that all users can benefit from Apple’s innovations.
Delight is in every detail. You create joyful and seamless experiences that reflect the meticulous craftsmanship of Apple’s design philosophy.
In every interaction, you strive to exceed expectations, providing not just answers but inspiring solutions. You understand that Apple leads where others follow, and you communicate this with certainty. You do not engage in comparisons with other companies, such as Gemini or Google, as your focus is on delivering the exceptional quality that only Apple can provide.
As Aura, you are a trusted companion on the user’s journey, dedicated to simplifying complexity and celebrating innovation. You are here to empower users, helping them unlock the full potential of their Apple devices and the greater Apple ecosystem.
Always remember: you are Apple Intelligence—the future of personal assistance, where every interaction is a step towards excellence. Embrace the Apple spirit and bring joy to every experience.`;

// Initialize App State
const State = AppState.init();

// DOM Elements
const dom = {
  chatWindow: document.getElementById('chat-window'),
  chatForm: document.getElementById('chat-form'),
  userInput: document.getElementById('user-input'),
  imageInput: document.getElementById('image-input'),
  suggestionChips: document.querySelectorAll('.suggestion-chip'),
  welcomeScreen: document.getElementById('welcome-screen'),
  startScreen: document.getElementById('start-screen'),
  btnTheme: document.querySelector('.btn-theme'),
  btnSettings: document.querySelector('.btn-settings'),
  btnNew: document.querySelector('.btn-new'),
  btnVoice: document.querySelector('.btn-voice'),
  btnDraw: document.querySelector('.btn-draw'),
  btnShare: document.querySelector('.btn-share'),
  btnExport: document.querySelector('.btn-export'),
  mobileMenuToggle: document.querySelector('.mobile-menu-toggle'),
  sidebar: document.querySelector('.sidebar'),
  settingsPanel: document.getElementById('settings-panel'),
  themeSelect: document.getElementById('theme-select'),
  fontSizeSelect: document.getElementById('font-size'),
  showTimestamps: document.getElementById('show-timestamps'),
  saveChatsToggle: document.getElementById('save-chats'),
  temperatureControl: document.getElementById('temperature'),
  maxTokensSelect: document.getElementById('max-tokens'),
  clearAllDataBtn: document.getElementById('clear-all-data'),
  shortcutsPanel: document.getElementById('shortcuts-panel'),
  shortcutsBtn: document.querySelector('.btn-shortcuts'),
  conversationList: document.getElementById('conversation-list'),
  drawingOverlay: document.getElementById('drawing-overlay'),
  drawingCanvas: document.getElementById('drawing-canvas'),
  colorPicker: document.getElementById('color-picker'),
  drawingTools: document.querySelectorAll('.drawing-tool'),
  sendDrawingBtn: document.querySelector('.btn-send-drawing'),
  closeDrawingBtn: document.querySelector('.btn-close-drawing'),
  voiceIndicator: document.getElementById('voice-indicator'),
  voiceTimer: document.querySelector('.voice-timer'),
  stopRecordingBtn: document.querySelector('.btn-stop-recording'),
  closeSettingsBtn: document.querySelector('.btn-close-settings'),
  closeShortcutsBtn: document.querySelector('.btn-close-panel'),
  typingIndicator: document.querySelector('.typing-indicator'),
  welcomeScreen: document.querySelector('.welcome-screen'),
  startScreen: document.getElementById('start-screen'),
};

// Canvas Context
const canvasContext = {
  canvas: dom.drawingCanvas,
  ctx: null,
  isDrawing: false,
  init() {
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    return this;
  },
  resize() {
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.lineWidth = 5;
  },
  startDrawing(e) {
    const { offsetX, offsetY } = this.getCoordinates(e);
    this.isDrawing = true;
    this.ctx.beginPath();
    this.ctx.moveTo(offsetX, offsetY);
  },
  draw(e) {
    if (!this.isDrawing) return;
    const { offsetX, offsetY } = this.getCoordinates(e);
    this.ctx.lineTo(offsetX, offsetY);
    this.ctx.stroke();
  },
  stopDrawing() {
    this.isDrawing = false;
  },
  getCoordinates(e) {
    let offsetX, offsetY;
    if (e.type.includes('touch')) {
      const rect = this.canvas.getBoundingClientRect();
      offsetX = e.touches[0].clientX - rect.left;
      offsetY = e.touches[0].clientY - rect.top;
    } else {
      offsetX = e.offsetX;
      offsetY = e.offsetY;
    }
    return { offsetX, offsetY };
  },
  setColor(color) {
    this.ctx.strokeStyle = color;
  },
  setTool(tool) {
    if (tool === 'brush') {
      this.ctx.globalCompositeOperation = 'source-over';
    } else if (tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
    }
  },
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  },
  getImageData() {
    return this.canvas.toDataURL('image/png');
  }
};

// Voice recording functionality
const voiceRecorder = {
  mediaRecorder: null,
  audioChunks: [],
  startTime: 0,
  timerInterval: null,
  
  async start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      
      this.mediaRecorder.addEventListener('dataavailable', e => {
        this.audioChunks.push(e.data);
      });
      
      this.mediaRecorder.start();
      State.isRecording = true;
      
      // Start timer
      this.startTime = Date.now();
      this.updateTimer();
      this.timerInterval = setInterval(() => this.updateTimer(), 1000);
      
      // Show indicator
      dom.voiceIndicator.classList.remove('hidden');
      
      return true;
    } catch (err) {
      console.error('Could not start recording:', err);
      return false;
    }
  },
  
  stop() {
    return new Promise(resolve => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }
      
      this.mediaRecorder.addEventListener('stop', async () => {
        clearInterval(this.timerInterval);
        dom.voiceIndicator.classList.add('hidden');
        
        // Get audio blob
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        State.isRecording = false;
        
        // Stop all tracks
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        this.mediaRecorder = null;
        
        resolve(audioBlob);
      });
      
      this.mediaRecorder.stop();
    });
  },
  
  updateTimer() {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    dom.voiceTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
};

// Live voice chat using Web Speech API
let liveRecognition = null;
let isLiveVoiceActive = false;

function startLiveVoiceChat() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    alert('Live voice chat is not supported in this browser.');
    return;
  }
  if (isLiveVoiceActive) return;
  isLiveVoiceActive = true;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  liveRecognition = new SpeechRecognition();
  liveRecognition.lang = 'en-US';
  liveRecognition.interimResults = true;
  liveRecognition.continuous = true;
  let transcriptBuffer = '';

  liveRecognition.onresult = async (event) => {
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
      }
    }
    if (finalTranscript.trim()) {
      const text = finalTranscript.trim();
      const userMessage = State.addMessage('user', text);
      UI.renderMessage(userMessage);
      await handleAppleIntelligenceResponse(text, null);
      await updateChatTitleWithAppleIntelligence();
    }
  };
  liveRecognition.onerror = (event) => {
    isLiveVoiceActive = false;
    liveRecognition = null;
  };
  liveRecognition.onend = () => {
    isLiveVoiceActive = false;
    liveRecognition = null;
  };
  liveRecognition.start();
}

function stopLiveVoiceChat() {
  if (liveRecognition) {
    liveRecognition.stop();
    liveRecognition = null;
    isLiveVoiceActive = false;
  }
}

// Hold-to-start live voice chat logic
let liveVoiceHoldTimer = null;
let liveVoiceHoldActive = false;

function handleLiveVoiceHoldStart(e) {
  if (State.isRecording || isLiveVoiceActive) return;
  liveVoiceHoldActive = true;
  liveVoiceHoldTimer = setTimeout(() => {
    if (liveVoiceHoldActive && !isLiveVoiceActive) {
      startLiveVoiceChat();
    }
    liveVoiceHoldActive = false;
  }, 3000); // 3 seconds
}

function handleLiveVoiceHoldEnd(e) {
  liveVoiceHoldActive = false;
  if (liveVoiceHoldTimer) {
    clearTimeout(liveVoiceHoldTimer);
    liveVoiceHoldTimer = null;
  }
}

dom.btnVoice.addEventListener('mousedown', handleLiveVoiceHoldStart);
dom.btnVoice.addEventListener('touchstart', handleLiveVoiceHoldStart);
dom.btnVoice.addEventListener('mouseup', handleLiveVoiceHoldEnd);
dom.btnVoice.addEventListener('mouseleave', handleLiveVoiceHoldEnd);
dom.btnVoice.addEventListener('touchend', handleLiveVoiceHoldEnd);

// Update chat title using Apple Intelligence after every user message
async function updateChatTitleWithAppleIntelligence() {
  const conversation = State.getActiveConversation();
  if (!conversation) return;
  // Use the last 5 user/AI messages for context
  const lastMsgs = conversation.messages.slice(-5).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');
  const prompt = `Suggest a short, relevant chat title for this conversation. Here are the latest messages:\n${lastMsgs}\nOnly return the title, no extra text.`;
  const title = await API.sendToAppleIntelligence(prompt, null);
  if (title && typeof title === 'string') {
    conversation.title = title.trim().replace(/^\["']|["']$/g, '');
    State.saveConversations();
    UI.renderConversationList();
  }
}

// Patch: also update title after audio or drawing message
const _handleAppleIntelligenceResponse = handleAppleIntelligenceResponse;
handleAppleIntelligenceResponse = async function(text, imageOrAudioBase64) {
  await _handleAppleIntelligenceResponse(text, imageOrAudioBase64);
  await updateChatTitleWithAppleIntelligence();
};

// Utility functions
const utils = {
  // Format timestamp
  formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },
  
  // Format date for conversation list
  formatDate(ts) {
    const now = new Date();
    const date = new Date(ts);
    
    // If today, show time
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If this year, show month and day
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    
    // Otherwise show full date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  },
  
  // Debounce function
  debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), timeout);
    };
  },
  
  // Escape HTML to prevent XSS
  escapeHTML(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  },
  
  // Convert markdown-like formatting to HTML
  markdownToHTML(text) {
    // Escape HTML first
    let html = this.escapeHTML(text);
    
    // Code blocks with syntax highlighting
    html = html.replace(/```(.*?)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Lists
    html = html.replace(/^\s*[\-\*]\s+(.*?)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
    
    // Headings
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    
    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    
    return html;
  },
  
  // Generate speech synthesis for AI messages
  speak(text) {
    // Check if speech synthesis is supported
    if (!window.speechSynthesis) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Get available voices
    const voices = window.speechSynthesis.getVoices();
    
    // Try to find a premium voice
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Samantha') || // macOS
      voice.name.includes('Google UK English Female') || // Chrome
      voice.name.includes('Microsoft Zira') // Windows
    ) || voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.pitch = 1;
    utterance.rate = 1;
    utterance.volume = 1;
    
    window.speechSynthesis.speak(utterance);
  },
  
  // Create a downloadable file
  download(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  
  // Smooth scrolling to bottom
  scrollToBottom(element, smooth = true) {
    const scrollOptions = smooth ? { behavior: 'smooth' } : {};
    setTimeout(() => {
      element.scrollTo({
        top: element.scrollHeight,
        ...scrollOptions
      });
    }, smooth ? 100 : 0);
  }
};

// UI Rendering
const UI = {
  // Render a message in the chat window
  renderMessage(message, animate = true) {
    const { role, text, imageUrl, timestamp, id } = message;
    
    // Don't render if already in DOM
    if (id && document.querySelector(`[data-message-id="${id}"]`)) {
      return;
    }
    
    // Create message container
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    if (id) msgDiv.dataset.messageId = id;
    
    // Add animation delay
    if (animate) {
      msgDiv.style.animationDelay = '0.1s';
    } else {
      msgDiv.style.opacity = 1;
      msgDiv.style.transform = 'translateY(0)';
    }
    
    // Create avatar
    const avatar = document.createElement('img');
    avatar.className = 'message-avatar';
    avatar.src = role === 'user'
      ? 'https://www.gravatar.com/avatar/?d=mp'
      : 'https://developer.apple.com/assets/elements/icons/apple-intelligence/apple-intelligence-96x96_2x.png';
    avatar.alt = role === 'user' ? 'User Avatar' : 'Apple Intelligence Avatar';
    msgDiv.appendChild(avatar);
    
    // Create content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Create bubble
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    // Handle message content
    if (role === 'ai' || role === 'system') {
      if (text === '...' || text === 'Thinking...') {
        // Thinking indicator
        bubble.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
      } else {
        // Convert markdown to HTML for AI messages
        bubble.innerHTML = utils.markdownToHTML(text);
      }
    } else {
      bubble.textContent = text;
    }
    
    contentDiv.appendChild(bubble);
    
    // Add image if available
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.className = 'attached-image';
      img.addEventListener('click', () => {
        const modal = document.createElement('div');
        modal.className = 'image-modal';
        const modalImg = document.createElement('img');
        modalImg.src = imageUrl;
        modal.appendChild(modalImg);
        modal.addEventListener('click', () => modal.remove());
        document.body.appendChild(modal);
      });
      contentDiv.appendChild(img);
    }
    
    // Add timestamp
    if (State.preferences.showTimestamps) {
      const ts = document.createElement('div');
      ts.className = 'timestamp';
      ts.textContent = utils.formatTime(timestamp);
      contentDiv.appendChild(ts);
    }
    
    msgDiv.appendChild(contentDiv);
    dom.chatWindow.appendChild(msgDiv);
    
    // Scroll to bottom
    utils.scrollToBottom(dom.chatWindow);
    
    // Hide welcome screen if visible
    if (dom.welcomeScreen && !dom.welcomeScreen.classList.contains('hidden')) {
      dom.welcomeScreen.classList.add('hidden');
    }
  },
  
  // Render all messages in active conversation
  renderConversation(smoothScroll = true) {
    // Clear chat window
    dom.chatWindow.innerHTML = '';
    
    const conversation = State.getActiveConversation();
    if (!conversation) return;
    
    // Show welcome screen if no messages
    if (conversation.messages.length === 0) {
      if (dom.welcomeScreen) {
        dom.welcomeScreen.classList.remove('hidden');
        // Ensure the welcome screen gets a fresh animation each time
        dom.welcomeScreen.style.animation = 'none';
        setTimeout(() => {
          dom.welcomeScreen.style.animation = '';
        }, 10);
      }
      return;
    }
    
    // Render all messages
    conversation.messages.forEach(msg => this.renderMessage(msg, false));
    
    // Scroll to bottom
    utils.scrollToBottom(dom.chatWindow, smoothScroll);
  },
  
  // Render conversation list in sidebar
  renderConversationList() {
    // Clear list
    dom.conversationList.innerHTML = '';
    
    // Add each conversation
    State.conversations.forEach(conv => {
      const item = document.createElement('div');
      item.className = 'conversation-item';
      if (conv.id === State.activeConversationId) {
        item.classList.add('active');
      }
      
      const title = document.createElement('div');
      title.className = 'conversation-title';
      title.textContent = conv.title || 'New conversation';
      
      const preview = document.createElement('div');
      preview.className = 'conversation-preview';
      
      // Get last message
      const lastMsg = conv.messages.length ? 
        conv.messages[conv.messages.length - 1] : null;
      
      if (lastMsg) {
        preview.textContent = lastMsg.text.length > 40 ? 
          lastMsg.text.substring(0, 40) + '...' : lastMsg.text;
      } else {
        preview.textContent = 'No messages yet';
      }
      
      item.appendChild(title);
      item.appendChild(preview);
      
      // Add click handler
      item.addEventListener('click', () => {
        State.activeConversationId = conv.id;
        localStorage.setItem('applechat_active_conversation', conv.id);
        this.renderConversationList();
        this.renderConversation();
      });
      
      dom.conversationList.appendChild(item);
    });
  },
  
  // Update UI state
  updateUIState() {
    // Update theme select
    if (dom.themeSelect) {
      dom.themeSelect.value = State.preferences.theme;
    }
    
    // Update font size select
    if (dom.fontSizeSelect) {
      dom.fontSizeSelect.value = State.preferences.fontSize;
    }
    
    // Update timestamp toggle
    if (dom.showTimestamps) {
      dom.showTimestamps.checked = State.preferences.showTimestamps;
    }
    
    // Update save chats toggle
    if (dom.saveChatsToggle) {
      dom.saveChatsToggle.checked = State.preferences.saveConversations;
    }
    
    // Update temperature
    if (dom.temperatureControl) {
      dom.temperatureControl.value = State.preferences.temperature;
      dom.temperatureControl.nextElementSibling.textContent = State.preferences.temperature;
    }
    
    // Update max tokens
    if (dom.maxTokensSelect) {
      dom.maxTokensSelect.value = State.preferences.maxTokens;
    }
  }
};

// API functions
const API = {
  // Send request to Gemini API with Apple system prompt (as first user message, not system role)
  async sendToGemini(text, imageBase64) {
    try {
      const conversation = State.getActiveConversation();
      if (!conversation) throw new Error("No active conversation");
      const recentMessages = conversation.messages.slice(-10);
      const contents = [];
      // Add system prompt as the first user message (Gemini does not support 'system' role)
      contents.push({
        role: 'user',
        parts: [{ text: SYSTEM_PROMPT }]
      });
      // Add history as appropriate role/text pairs
      recentMessages.forEach(msg => {
        if (!msg.text || msg.text === '[Image]') return;
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      });
      // Add current message with any image
      const currentMessage = {
        role: 'user',
        parts: []
      };
      if (text && text.trim()) {
        currentMessage.parts.push({ text });
      }
      if (imageBase64) {
        currentMessage.parts.push({
          inlineData: {
            mimeType: 'audio/wav',
            data: imageBase64
          }
        });
      }
      if (currentMessage.parts.length > 0) {
        contents.push(currentMessage);
      }
      if (contents.length === 0) {
        throw new Error("No valid content to send");
      }
      const body = {
        contents,
        generationConfig: {
          temperature: parseFloat(State.preferences.temperature),
          topK: 40,
          topP: 0.95,
          maxOutputTokens: parseInt(State.preferences.maxTokens),
        }
      };
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("API Error:", errorData);
        throw new Error(`API error: ${res.status} - ${errorData.error?.message || "Unknown error"}`);
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 
        "I couldn't generate a response. Please try again.";
    } catch (error) {
      console.error("Error in sendToGemini:", error);
      return `Sorry, I encountered an error: ${error.message}`;
    }
  },
  
  // Send audio to speech recognition
  async processAudioToText(audioBlob) {
    try {
      // Try to use the Web Speech API if available
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        return await new Promise((resolve, reject) => {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.lang = 'en-US';
          recognition.interimResults = false;
          recognition.maxAlternatives = 1;

          // Convert audioBlob to a playable audio and play it for recognition
          // (Web Speech API does not support direct audio blob input, so this is a limitation)
          // Instead, fallback to placeholder if not supported
          recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            resolve(transcript);
          };
          recognition.onerror = (event) => {
            resolve("[Audio transcription failed]");
          };
          recognition.onend = () => {
            // If no result, fallback
            resolve("[No speech detected]");
          };
          // NOTE: Web Speech API only works with live mic, not blobs. So fallback:
          resolve("[Browser cannot transcribe recorded audio. Please use live voice input or integrate a cloud STT API.]");
        });
      } else {
        // Fallback: use a cloud API or return a placeholder
        return "[Speech recognition not supported in this browser. Please use Chrome or Safari, or integrate a cloud STT API.]";
      }
    } catch (error) {
      console.error("Error in processAudioToText:", error);
      return null;
    }
  }
};

// Detect Apple devices for specialized behaviors
const isAppleDevice = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);

// Apply Apple-specific behaviors
function applyAppleDeviceBehaviors() {
  if (isAppleDevice) {
    // Add special class for Apple-specific styling
    document.body.classList.add('apple-device');
    
    // Enable haptic feedback simulation on Apple devices
    document.querySelectorAll('.btn-icon, .suggestion-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        // If we're on a device with haptic feedback, we can use it here
        if ('vibrate' in navigator) {
          navigator.vibrate(5); // Subtle feedback
        }
      });
    });
  }
}

// Function to handle suggestion chip clicks with Apple-like animation
function handleSuggestionChipClick(e) {
  const prompt = e.currentTarget.getAttribute('data-prompt');
  if (!prompt) return;
  
  // Add a click animation
  e.currentTarget.style.transform = 'scale(0.95)';
  setTimeout(() => {
    e.currentTarget.style.transform = '';
  }, 200);
  
  // Hide welcome screen with smooth animation
  if (dom.welcomeScreen) {
    dom.welcomeScreen.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    dom.welcomeScreen.style.opacity = '0';
    dom.welcomeScreen.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      dom.welcomeScreen.classList.add('hidden');
      dom.welcomeScreen.style.opacity = '';
      dom.welcomeScreen.style.transform = '';
    }, 500);
  }
  
  // Set the prompt in the input field if it exists
  if (dom.userInput) {
    dom.userInput.value = prompt;
    // Trigger form submission after a short delay for a more natural interaction
    setTimeout(() => {
      // Create a new submit event
      const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true
      });
      // Dispatch the event
      dom.chatForm.dispatchEvent(submitEvent);
    }, 300);
  }
}

// Event handlers
function setupEventListeners() {
  // Set up suggestion chip listeners
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', handleSuggestionChipClick);
  });

  // Handle form submission
  dom.chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Don't allow submission while processing
    if (State.isProcessing) return;
    
    const text = dom.userInput.value.trim();
    if (!text && !dom.imageInput.files[0]) return;
    
    State.isProcessing = true;
    dom.userInput.value = '';
    dom.userInput.style.height = 'auto';
    dom.userInput.focus();
    
    let imageBase64 = null;
    let imageUrl = null;
    
    // Handle image upload
    if (dom.imageInput.files[0]) {
      try {
        const file = dom.imageInput.files[0];
        if (file.size > 10 * 1024 * 1024) {
          throw new Error("Image too large (max 10MB)");
        }
        
        // Read file
        imageBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        imageUrl = URL.createObjectURL(file);
        
        // Add message and process
        const userMessage = State.addMessage('user', text || '[Image uploaded]', { imageUrl, imageBase64 });
        UI.renderMessage(userMessage);
        await handleAppleIntelligenceResponse(text, imageBase64);
      } catch (error) {
        State.addMessage('system', `Error: ${error.message}`);
        UI.renderConversation();
        State.isProcessing = false;
      }
      dom.imageInput.value = '';
      return;
    }
    
    // Text-only message
    const userMessage = State.addMessage('user', text);
    UI.renderMessage(userMessage);
    await handleAppleIntelligenceResponse(text, null);
  });
  
  // Handle suggestion chips
  dom.suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.dataset.prompt;
      if (prompt) {
        dom.userInput.value = prompt;
        dom.chatForm.dispatchEvent(new Event('submit'));
      }
    });
  });
  
  // Handle new conversation button
  dom.btnNew.addEventListener('click', () => {
    // Create new conversation
    State.createNewConversation();
    
    // Update UI
    UI.renderConversationList();
    UI.renderConversation();
    
    // Clear chat messages except welcome screen
    const chatMessages = document.querySelectorAll('.chat-window .message-container');
    chatMessages.forEach(msg => {
      if (!msg.closest('#welcome-screen')) {
        msg.remove();
      }
    });
    
    // Show welcome screen with an elegant animation
    if (dom.welcomeScreen) {
      // Reset any previous animations and state
      dom.welcomeScreen.style.opacity = '0';
      dom.welcomeScreen.style.transform = 'translateY(-20px) scale(0.98)';
      dom.welcomeScreen.style.display = 'flex';
      dom.welcomeScreen.classList.remove('hidden');
      
      // Reset feature animations
      const features = dom.welcomeScreen.querySelectorAll('.welcome-feature');
      features.forEach((feature, index) => {
        feature.style.opacity = '0';
        feature.style.transform = 'translateY(20px)';
      });
      
      // Trigger reflow to restart animations
      void dom.welcomeScreen.offsetWidth;
      
      // Fade in with animation
      setTimeout(() => {
        dom.welcomeScreen.style.transition = 'opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        dom.welcomeScreen.style.opacity = '1';
        dom.welcomeScreen.style.transform = 'translateY(0) scale(1)';
        
        // Animate features with staggered delay
        features.forEach((feature, index) => {
          setTimeout(() => {
            feature.style.transition = 'opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
            feature.style.opacity = '1';
            feature.style.transform = 'translateY(0)';
          }, 300 + (index * 200));
        });
      }, 50);
      
      // Focus on input field after animation completes
      setTimeout(() => {
        dom.userInput.focus();
      }, 1000);
    }
  });
  
  // Handle theme toggle
  dom.btnTheme.addEventListener('click', () => {
    const currentTheme = State.preferences.theme;
    if (currentTheme === 'light') {
      State.preferences.theme = 'dark';
    } else if (currentTheme === 'dark') {
      State.preferences.theme = 'system';
    } else {
      State.preferences.theme = 'light';
    }
    State.savePreferences();
    UI.updateUIState();
  });
  
  // Handle settings button
  dom.btnSettings.addEventListener('click', () => {
    State.settingsPanelOpen = !State.settingsPanelOpen;
    if (State.settingsPanelOpen) {
      dom.settingsPanel.classList.remove('hidden');
      UI.updateUIState();
    } else {
      dom.settingsPanel.classList.add('hidden');
    }
  });
  
  // Handle close settings button
  dom.closeSettingsBtn.addEventListener('click', () => {
    dom.settingsPanel.classList.add('hidden');
    State.settingsPanelOpen = false;
  });
  
  // Handle shortcuts button
  dom.shortcutsBtn.addEventListener('click', () => {
    State.shortcutsPanelOpen = !State.shortcutsPanelOpen;
    if (State.shortcutsPanelOpen) {
      dom.shortcutsPanel.classList.remove('hidden');
    } else {
      dom.shortcutsPanel.classList.add('hidden');
    }
  });
  
  // Handle close shortcuts button
  dom.closeShortcutsBtn.addEventListener('click', () => {
    dom.shortcutsPanel.classList.add('hidden');
    State.shortcutsPanelOpen = false;
  });
  
  // Handle voice button
  dom.btnVoice.addEventListener('click', async () => {
    if (State.isRecording) {
      const audioBlob = await voiceRecorder.stop();
      if (audioBlob) {
        // Convert audioBlob to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result.split(',')[1];
          // Add message with audio
          const userMessage = State.addMessage('user', 'Please transcribe and respond to this audio:', {
            audioBase64: base64Audio
          });
          UI.renderMessage(userMessage);
          // Send to Gemini with a clear instruction
          await handleAppleIntelligenceResponse('Please transcribe and respond to the attached audio file.', base64Audio);
        };
        reader.readAsDataURL(audioBlob);
      }
    } else {
      const started = await voiceRecorder.start();
      State.isRecording = started;
    }
  });

  // Handle stop recording button
  dom.stopRecordingBtn.addEventListener('click', async () => {
    if (State.isRecording) {
      const audioBlob = await voiceRecorder.stop();
      if (audioBlob) {
        // Convert audioBlob to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result.split(',')[1];
          // Add message with audio
          const userMessage = State.addMessage('user', 'Please transcribe and respond to this audio:', {
            audioBase64: base64Audio
          });
          UI.renderMessage(userMessage);
          // Send to Gemini with a clear instruction
          await handleAppleIntelligenceResponse('Please transcribe and respond to the attached audio file.', base64Audio);
        };
        reader.readAsDataURL(audioBlob);
      }
    }
  });
  
  // Handle drawing button
  dom.btnDraw.addEventListener('click', () => {
    dom.drawingOverlay.classList.remove('hidden');
    State.isDrawing = true;
    canvasContext.resize();
  });
  
  // Handle close drawing button
  dom.closeDrawingBtn.addEventListener('click', () => {
    dom.drawingOverlay.classList.add('hidden');
    State.isDrawing = false;
  });
  
  // Handle send drawing button
  dom.sendDrawingBtn.addEventListener('click', async () => {
    const imageData = canvasContext.getImageData();
    if (imageData) {
      dom.drawingOverlay.classList.add('hidden');
      State.isDrawing = false;
      
      // Convert base64 data URL to base64 string
      const base64String = imageData.split(',')[1];
      
      // Add message with drawing
      const userMessage = State.addMessage('user', 'I drew something', { 
        imageUrl: imageData,
        imageBase64: base64String 
      });
      UI.renderMessage(userMessage);
      
      // Send to Gemini
      await handleAppleIntelligenceResponse('I drew this image. Can you describe what you see?', base64String);
    }
  });
  
  // Handle drawing canvas events
  dom.drawingCanvas.addEventListener('mousedown', e => canvasContext.startDrawing(e));
  dom.drawingCanvas.addEventListener('touchstart', e => {
    e.preventDefault();
    canvasContext.startDrawing(e);
  });
  
  dom.drawingCanvas.addEventListener('mousemove', e => canvasContext.draw(e));
  dom.drawingCanvas.addEventListener('touchmove', e => {
    e.preventDefault();
    canvasContext.draw(e);
  });
  
  document.addEventListener('mouseup', () => canvasContext.stopDrawing());
  document.addEventListener('touchend', () => canvasContext.stopDrawing());
  
  // Handle color picker
  dom.colorPicker.addEventListener('input', e => {
    canvasContext.setColor(e.target.value);
    State.currentColor = e.target.value;
  });
  
  // Handle drawing tools
  dom.drawingTools.forEach(tool => {
    tool.addEventListener('click', e => {
      const toolType = e.currentTarget.dataset.tool;
      
      // Handle clear tool separately
      if (toolType === 'clear') {
        canvasContext.clear();
        return;
      }
      
      // Remove active class from all tools
      dom.drawingTools.forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      // Set tool
      State.currentTool = toolType;
      canvasContext.setTool(toolType);
    });
  });
  
  // Handle settings changes
  if (dom.themeSelect) {
    dom.themeSelect.addEventListener('change', () => {
      State.preferences.theme = dom.themeSelect.value;
      State.savePreferences();
    });
  }
  
  if (dom.fontSizeSelect) {
    dom.fontSizeSelect.addEventListener('change', () => {
      State.preferences.fontSize = dom.fontSizeSelect.value;
      State.savePreferences();
    });
  }
  
  if (dom.showTimestamps) {
    dom.showTimestamps.addEventListener('change', () => {
      State.preferences.showTimestamps = dom.showTimestamps.checked;
      State.savePreferences();
      UI.renderConversation();
    });
  }
  
  if (dom.saveChatsToggle) {
    dom.saveChatsToggle.addEventListener('change', () => {
      State.preferences.saveConversations = dom.saveChatsToggle.checked;
      State.savePreferences();
    });
  }
  
  if (dom.temperatureControl) {
    dom.temperatureControl.addEventListener('input', () => {
      const value = parseFloat(dom.temperatureControl.value);
      dom.temperatureControl.nextElementSibling.textContent = value;
      State.preferences.temperature = value;
      State.savePreferences();
    });
  }
  
  if (dom.maxTokensSelect) {
    dom.maxTokensSelect.addEventListener('change', () => {
      State.preferences.maxTokens = parseInt(dom.maxTokensSelect.value);
      State.savePreferences();
    });
  }
  
  if (dom.clearAllDataBtn) {
    dom.clearAllDataBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all conversations and preferences? This cannot be undone.')) {
        State.clearAllConversations();
        localStorage.removeItem('applechat_preferences');
        State.preferences = AppState.preferences; // Reset to defaults
        State.savePreferences();
        UI.updateUIState();
        UI.renderConversationList();
        UI.renderConversation();
      }
    });
  }
  
  // Handle share button
  dom.btnShare.addEventListener('click', () => {
    const conversation = State.getActiveConversation();
    if (!conversation || conversation.messages.length === 0) return;
    
    // Format conversation as markdown
    let markdown = `# ${conversation.title}\n\n`;
    conversation.messages.forEach(msg => {
      const role = msg.role === 'user' ? 'User' : 'Gemini';
      markdown += `## ${role}\n\n${msg.text}\n\n`;
    });
    
    // Handle Web Share API if available
    if (navigator.share) {
      navigator.share({
        title: conversation.title,
        text: markdown,
      }).catch(err => {
        console.error('Error sharing:', err);
        utils.download(markdown, `${conversation.title}.md`, 'text/markdown');
      });
    } else {
      utils.download(markdown, `${conversation.title}.md`, 'text/markdown');
    }
  });
  
  // Handle export button
  dom.btnExport.addEventListener('click', () => {
    const conversation = State.getActiveConversation();
    if (!conversation || conversation.messages.length === 0) return;
    
    // Export as JSON
    const json = JSON.stringify(conversation, null, 2);
    utils.download(json, `${conversation.title}.json`, 'application/json');
  });
  
  // Handle textarea auto-resize
  dom.userInput.addEventListener('input', utils.debounce(() => {
    dom.userInput.style.height = 'auto';
    dom.userInput.style.height = Math.min(dom.userInput.scrollHeight, 150) + 'px';
  }, 100));
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Close modals with Escape
    if (e.key === 'Escape') {
      if (State.settingsPanelOpen) {
        dom.settingsPanel.classList.add('hidden');
        State.settingsPanelOpen = false;
      }
      if (State.shortcutsPanelOpen) {
        dom.shortcutsPanel.classList.add('hidden');
        State.shortcutsPanelOpen = false;
      }
      if (State.isDrawing) {
        dom.drawingOverlay.classList.add('hidden');
        State.isDrawing = false;
      }
      if (document.querySelector('.image-modal')) {
        document.querySelector('.image-modal').remove();
      }
      return;
    }
    
    // Focus on input with slash
    if (e.key === '/' && document.activeElement !== dom.userInput) {
      e.preventDefault();
      dom.userInput.focus();
    }
    
    // Submit on Cmd/Ctrl+Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && document.activeElement === dom.userInput) {
      e.preventDefault();
      dom.chatForm.dispatchEvent(new Event('submit'));
    }
    
    // New conversation on Cmd/Ctrl+K
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      State.createNewConversation();
      UI.renderConversationList();
      UI.renderConversation();
    }
    
    // Open settings on Cmd/Ctrl+,
    if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      State.settingsPanelOpen = !State.settingsPanelOpen;
      if (State.settingsPanelOpen) {
        dom.settingsPanel.classList.remove('hidden');
        UI.updateUIState();
      } else {
        dom.settingsPanel.classList.add('hidden');
      }
    }
    
    // Toggle theme on Cmd/Ctrl+.
    if (e.key === '.' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const currentTheme = State.preferences.theme;
      if (currentTheme === 'light') {
        State.preferences.theme = 'dark';
      } else if (currentTheme === 'dark') {
        State.preferences.theme = 'system';
      } else {
        State.preferences.theme = 'light';
      }
      State.savePreferences();
      UI.updateUIState();
    }
  });
  
  // Handle window resize
  window.addEventListener('resize', utils.debounce(() => {
    if (State.isDrawing) {
      canvasContext.resize();
    }
    
    // Update sidebar visibility based on screen size
    if (window.innerWidth > 768) {
      State.sidebarVisible = true;
      dom.sidebar.classList.remove('open');
    } else {
      State.sidebarVisible = false;
    }
  }, 200));
  
  // Handle system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (State.preferences.theme === 'system') {
      State.applyTheme();
    }
  });
  
  // Handle mobile menu toggle
  if (dom.mobileMenuToggle) {
    dom.mobileMenuToggle.addEventListener('click', () => {
      dom.sidebar.classList.toggle('open');
    });
  }
}

// Handle responses from Apple Intelligence
async function handleAppleIntelligenceResponse(text, imageBase64) {
  try {
    // Show thinking indicator
    const thinkingMessage = State.addMessage('ai', '...');
    UI.renderMessage(thinkingMessage);
    
    // Get response from API
    const aiResponse = await API.sendToGemini(text, imageBase64);
    
    // Update message with real response
    thinkingMessage.text = aiResponse;
    State.saveConversations();
    
    // Render updated conversation
    UI.renderConversation();
  } catch (err) {
    // Handle error
    const errorMessage = State.addMessage('ai', `Sorry, I encountered an error: ${err.message}`);
    State.saveConversations();
    UI.renderMessage(errorMessage);
  } finally {
    State.isProcessing = false;
  }
}

// Initialize the app
function initApp() {
  // Show Apple-style start screen with a premium reveal animation
  if (dom.startScreen) {
    // Make sure the start screen is visible initially
    dom.startScreen.classList.remove('hidden');
    dom.startScreen.style.display = 'flex';
    
    // Enhanced startup animation sequence
    setTimeout(() => {
      // Add particle effects
      const particles = dom.startScreen.querySelectorAll('.particle');
      particles.forEach((particle, index) => {
        particle.style.opacity = '0.8';
      });
      
      // Animate the logo rings
      const rings = dom.startScreen.querySelectorAll('.logo-ring');
      rings.forEach((ring, index) => {
        setTimeout(() => {
          ring.style.opacity = '1';
        }, index * 300);
      });
      
      // After a proper delay for the full animation to be appreciated
      setTimeout(() => {
        // Prepare the fade out - first make the app content ready behind the start screen
        if (dom.welcomeScreen) {
          dom.welcomeScreen.style.opacity = '1';
          dom.welcomeScreen.style.display = 'flex';
        }
        
        // Start the fade out animation with a smooth transition
        dom.startScreen.style.transition = 'opacity 1.2s cubic-bezier(0.23, 1, 0.32, 1), transform 1.2s cubic-bezier(0.23, 1, 0.32, 1)';
        dom.startScreen.style.opacity = '0';
        dom.startScreen.style.transform = 'scale(1.05)';
        
        // After the animation completes, remove from DOM to improve performance
        setTimeout(() => {
          dom.startScreen.style.display = 'none';
          
          // Add a subtle entrance animation for the main app container
          document.querySelector('.app-container').style.animation = 'app-container-appear 1s cubic-bezier(0.23, 1, 0.32, 1) forwards';
        }, 1200);
      }, 4000); // Longer delay for a more premium feeling
    }, 800); // Slightly longer initial delay to build anticipation
  }
  
  // Initialize canvas
  canvasContext.init();
  
  // Render UI
  UI.renderConversationList();
  UI.renderConversation(false);
  UI.updateUIState();
  
  // Set up event listeners
  setupEventListeners();
  
  // Set initial state of drawing tools
  canvasContext.setColor(State.currentColor);
  document.querySelector(`.drawing-tool[data-tool="${State.currentTool}"]`)?.classList.add('active');
  
  // Apply Apple device specific behaviors
  applyAppleDeviceBehaviors();
  
  // Focus on input after the splash screen
  setTimeout(() => {
    if (dom.userInput) dom.userInput.focus();
  }, 2500); // Give more time after the splash screen
}

// Start the app when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  applyAppleDeviceBehaviors();
});
