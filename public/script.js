const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const submitButton = form.querySelector('button[type="submit"]');

const conversation = [];
let isSending = false;

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage || isSending) return;

  appendMessage('user', userMessage);
  input.value = '';

  conversation.push({ role: 'user', text: userMessage });
  const pendingMessage = appendMessage('bot', '');
  showThinkingIndicator(pendingMessage);

  isSending = true;
  submitButton.disabled = true;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation })
    });

    if (!response.ok) {
      throw new Error(`Chat request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (typeof data.result !== 'string' || !data.result.trim()) {
      setMessageText(pendingMessage, 'Sorry, no response received.');
      conversation.pop();
      return;
    }

    renderMarkdown(pendingMessage, data.result);
    conversation.push({ role: 'model', text: data.result });
  } catch (error) {
    console.error('Failed to get chat response:', error);
    setMessageText(pendingMessage, 'Failed to get response from server.');
    conversation.pop();
  } finally {
    isSending = false;
    submitButton.disabled = false;
    input.focus();
  }
});

function appendMessage(sender, text) {
  const message = document.createElement('div');
  message.classList.add('message', sender);
  message.textContent = text;
  chatBox.appendChild(message);
  chatBox.scrollTop = chatBox.scrollHeight;
  return message;
}

function showThinkingIndicator(message) {
  message.classList.add('is-thinking');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-label', 'AI sedang menyiapkan jawaban');

  const reactor = document.createElement('span');
  reactor.classList.add('thinking-reactor');
  reactor.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.classList.add('thinking-label');
  label.textContent = 'Menyiapkan jawaban';

  const dots = document.createElement('span');
  dots.classList.add('thinking-dots');
  dots.setAttribute('aria-hidden', 'true');
  dots.textContent = '...';

  message.append(reactor, label, dots);
}

function setMessageText(message, text) {
  message.classList.remove('is-thinking');
  message.removeAttribute('role');
  message.removeAttribute('aria-label');
  message.textContent = text;
}

function renderMarkdown(container, markdown) {
  container.replaceChildren();
  container.classList.remove('is-thinking');
  container.removeAttribute('role');
  container.removeAttribute('aria-label');

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^\s*```/.test(line)) {
      const codeLines = [];
      index += 1;

      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) index += 1;

      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = codeLines.join('\n');
      pre.appendChild(code);
      container.appendChild(pre);
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const element = document.createElement(`h${heading[1].length}`);
      appendInlineMarkdown(element, heading[2]);
      container.appendChild(element);
      index += 1;
      continue;
    }

    if (/^\s{0,3}(---+|___+|\*\*\*+)\s*$/.test(line)) {
      container.appendChild(document.createElement('hr'));
      index += 1;
      continue;
    }

    const listMatch = line.match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const isOrdered = /^\d/.test(listMatch[1]);
      const list = document.createElement(isOrdered ? 'ol' : 'ul');

      while (index < lines.length) {
        const itemMatch = lines[index].match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);
        if (!itemMatch || /^\d/.test(itemMatch[1]) !== isOrdered) break;

        const item = document.createElement('li');
        appendInlineMarkdown(item, itemMatch[2]);
        list.appendChild(item);
        index += 1;
      }

      container.appendChild(list);
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*```/.test(lines[index]) &&
      !/^\s{0,3}#{1,3}\s+/.test(lines[index]) &&
      !/^\s{0,3}(---+|___+|\*\*\*+)\s*$/.test(lines[index]) &&
      !/^\s*([-*+]|\d+[.)])\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    const paragraph = document.createElement('p');
    appendInlineMarkdown(paragraph, paragraphLines.join(' '));
    container.appendChild(paragraph);
  }

  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendInlineMarkdown(container, text) {
  const tokenPattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
  let lastIndex = 0;
  let match;

  while ((match = tokenPattern.exec(text)) !== null) {
    container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));

    if (match[2] && match[3]) {
      const link = document.createElement('a');
      link.textContent = match[2];
      link.href = match[3];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      container.appendChild(link);
    } else if (match[4] || match[5]) {
      const strong = document.createElement('strong');
      strong.textContent = match[4] || match[5];
      container.appendChild(strong);
    } else if (match[6]) {
      const del = document.createElement('del');
      del.textContent = match[6];
      container.appendChild(del);
    } else if (match[7]) {
      const code = document.createElement('code');
      code.textContent = match[7];
      container.appendChild(code);
    } else {
      const emphasis = document.createElement('em');
      emphasis.textContent = match[8] || match[9];
      container.appendChild(emphasis);
    }

    lastIndex = tokenPattern.lastIndex;
  }

  container.appendChild(document.createTextNode(text.slice(lastIndex)));
}
