import commentsData from './comments-data.json';

const commentAvatarUrls = import.meta.glob('./assets/comments/*', {
  eager: true,
  query: '?url',
  import: 'default',
});

const feed = document.getElementById('commentsFeed');
const countEl = document.getElementById('commentsCount');
const composer = document.getElementById('commentComposer');
const textInput = document.getElementById('commentText');
const composerAvatar = document.getElementById('composerAvatar');
const fieldWrap = composer?.querySelector('.comments-composer-shell');

const NAME_KEY = 'aiTradingLocalCommentName';

let remoteData = commentsData;

function ukCommentData(data) {
  const replacements = [
    [/Sydney/g, 'London'],
    [/Melbourne/g, 'Manchester'],
    [/Brisbane/g, 'Birmingham'],
    [/Perth/g, 'Leeds'],
    [/Adelaide/g, 'Liverpool'],
    [/Canberra/g, 'Edinburgh'],
    [/Gold Coast/g, 'Bristol'],
    [/Hobart/g, 'Glasgow'],
    [/\$250/g, '£186'],
    [/\$72/g, '£54'],
    [/\$118/g, '£89'],
    [/\$140-210/g, '£105-158'],
    [/\$520/g, '£390'],
    [/\$500-900/g, '£375-675'],
    [/\$550-700/g, '£413-525'],
    [/\$450-800/g, '£338-600'],
    [/\$450/g, '£338'],
    [/\$650/g, '£488'],
    [/\$15k/g, '£11k'],
    [/\$160-250/g, '£120-186'],
    [/Opal card/g, 'Oyster card'],
    [/CommBank app/g, 'Lloyds Bank app'],
    [/ASIC-regulated/g, 'FCA-regulated'],
    [/ASIC website/g, 'FCA register'],
    [/under recognised financial market regulations/g, 'under UK financial-services regulations']
  ];
  const localize = item => ({
    ...item,
    text: replacements.reduce((text, [pattern, value]) => text.replace(pattern, value), item.text)
  });
  return {
    comments: data.comments.map(localize),
    replies: (data.replies || []).map(localize)
  };
}

function resolveAvatarUrl(avatar) {
  const sourceKey = `./${String(avatar).replace(/^\.\//, '')}`;
  return commentAvatarUrls[sourceKey] || avatar;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initialsFromName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'You';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function displayName() {
  return sessionStorage.getItem(NAME_KEY)?.trim() || 'You';
}

function commentArticle({ name, avatar, text, time_ago, likes }, { reply = false } = {}) {
  const likeLabel = likes === 1 ? '1 like' : `${likes} likes`;

  return `
    <article class="comment${reply ? ' reply' : ''}">
      <img class="comment-avatar" src="${escapeHtml(resolveAvatarUrl(avatar))}" alt="${escapeHtml(name)}" width="40" height="40" loading="lazy" decoding="async">
      <div>
        <div class="comment-bubble">
          <strong>${escapeHtml(name)}</strong>
          <p>${escapeHtml(text)}</p>
        </div>
        <div class="comment-meta">${likeLabel} · Reply · ${escapeHtml(time_ago)}</div>
      </div>
    </article>`;
}

function renderAll() {
  if (!feed) return;

  const { comments, replies = [] } = remoteData;
  const repliesByParent = replies.reduce((map, reply) => {
    const key = reply.reply_to;
    if (!map[key]) map[key] = [];
    map[key].push(reply);
    return map;
  }, {});

  feed.innerHTML = comments
    .map((comment) => {
      const thread = [commentArticle(comment)];
      (repliesByParent[comment.name] || []).forEach((reply) => {
        thread.push(commentArticle(reply, { reply: true }));
      });
      return thread.join('');
    })
    .join('');

  const total = comments.length + replies.length;
  if (countEl) countEl.textContent = `${total} comment${total === 1 ? '' : 's'}`;
}

function syncComposerAvatar() {
  if (composerAvatar) composerAvatar.textContent = initialsFromName(displayName());
}

function resizeComposerField() {
  if (!textInput) return;
  textInput.style.height = 'auto';
  textInput.style.height = `${Math.min(textInput.scrollHeight, 140)}px`;
  fieldWrap?.classList.toggle('has-text', Boolean(textInput.value.trim()));
}

function handleComposerSubmit(event) {
  event.preventDefault();
  if (!textInput) return;

  const text = textInput.value.trim();
  if (!text) return;

  sessionStorage.setItem(NAME_KEY, displayName());
  textInput.value = '';
  resizeComposerField();
}

composer?.addEventListener('submit', handleComposerSubmit);

textInput?.addEventListener('input', resizeComposerField);

textInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    composer?.requestSubmit();
  }
});

sessionStorage.removeItem('aiTradingLocalComments');
syncComposerAvatar();

Promise.resolve(window.marketingSessionReady).then(() => {
  if (window.marketingCountry === 'GB' || window.marketingIsUk === true) {
    remoteData = ukCommentData(commentsData);
  }
  renderAll();
});
