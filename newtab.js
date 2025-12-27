function isURL(text) {
// Check if text contains common domain extensions
const hasDomainExtension = /\.(com|net|org|edu|gov|io|co|uk|us|ca|au|de|fr|jp|cn|in|br|ru|it|es|nl|se|no|dk|fi|pl|be|ch|at|cz|gr|pt|nz|za|mx|ar|cl|pe|ve|sg|my|th|vn|ph|id|kr|tw|hk|ae|sa|eg|ng|ke|gh|tz|ug|zm|zw|bw|mw|rw|sn|ci|cm|cd|ao|mz|mg|mu|sc|re|yt|km|dj|so|et|er|sd|ss|ly|tn|dz|ma|mr|ml|ne|td|cf|cg|ga|gq|st|cv|gw|gm|sl|lr|bf|bj|tg|gh|ng|ne|sn|gn|ci|ml|mr|dz|tn|ly|eg|sd|ss|et|er|dj|so|ke|ug|tz|rw|bi|mw|zm|zw|bw|na|za|ls|sz|mg|mu|sc|re|yt|km|app|dev|tech|online|site|website|store|shop|blog|news|info|biz|xyz|top|pro|club|live|today|world|space|fun|life|design|art|music|video|photo|game|tv|film|movie|book|food|travel|health|fitness|sport|fashion|beauty|style|home|garden|auto|car|bike|pet|baby|kids|family|love|dating|social|chat|mail|email|cloud|host|server|web|net|link|url|page|html|css|js|json|xml|api|app|software|code|dev|tech|digital|cyber|data|analytics|ai|ml|bot|iot|vr|ar|3d|media|press|radio|podcast|stream|play|watch|listen|read|learn|edu|study|course|class|school|university|college|academy|training|tutorial|guide|help|support|service|solution|platform|system|tool|tools|app|apps|software|program|download|upload|file|files|doc|docs|pdf|zip|rar|exe|apk|dmg|iso|img|png|jpg|jpeg|gif|svg|mp3|mp4|avi|mov|wmv|flv|mkv|wav|ogg|webm|m4a|m4v|3gp|3g2|aac|flac|wma|txt|rtf|csv|xls|xlsx|ppt|pptx|docx|odt|ods|odp|pages|numbers|keynote|ai|psd|sketch|fig|xd|indd|eps|cdr|dwg|dxf|stl|obj|fbx|blend|max|c4d|ma|mb|zpr|ztl|spp|sbsar|sbs|mtl|dae|gltf|glb|usdz|abc|vdb|bgeo|hip|hda|otl|hdanc|hdalc|hdabc|hda)(\b|\/)/i;
return hasDomainExtension.test(text) || text.startsWith('http://') || text.startsWith('https://');
}

function normalizeURL(text) {
// Add https:// if no protocol specified
if (!text.startsWith('http://') && !text.startsWith('https://')) {
return 'https://' + text;
}
return text;
}

async function fetchPageTitle(url) {
try {
const response = await fetch(url);
const html = await response.text();
const match = html.match(/<title>(.*?)<\/title>/i);
return match ? match[1] : url;
} catch (error) {
console.error('Error fetching title:', error);
return url;
}
}

document.getElementById('submit').addEventListener('click', async () => {
const intent = document.getElementById('intent').value.trim();
if (!intent) return;

const tab = await chrome.tabs.getCurrent();

if (isURL(intent)) {
// User typed a URL
const url = normalizeURL(intent);

// Fetch the page title
const title = await fetchPageTitle(url);

chrome.storage.local.get('tabIntents', data => {
const intents = data.tabIntents || [];
intents.push({
tabId: tab.id,
intent: title,
url: null,
createdAt: new Date().toISOString()
});
chrome.storage.local.set({ tabIntents: intents }, () => {
window.location.href = url;
});
});
} else {
// Regular intent text
chrome.storage.local.get('tabIntents', data => {
const intents = data.tabIntents || [];
intents.push({
tabId: tab.id,
intent,
url: null,
createdAt: new Date().toISOString()
});
chrome.storage.local.set({ tabIntents: intents }, () => {
window.location.href = 'https://www.google.com';
});
});
}
});

document.getElementById('search').addEventListener('click', async () => {
const intent = document.getElementById('intent').value.trim();
if (!intent) return;

const tab = await chrome.tabs.getCurrent();

chrome.storage.local.get('tabIntents', data => {
const intents = data.tabIntents || [];
intents.push({
tabId: tab.id,
intent,
url: null,
createdAt: new Date().toISOString()
});
chrome.storage.local.set({ tabIntents: intents }, () => {
const searchQuery = encodeURIComponent(intent);
window.location.href = `https://www.google.com/search?q=${searchQuery}`;
});
});
});