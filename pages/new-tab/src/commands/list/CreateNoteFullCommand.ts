// import { CommandModule } from '../types';

// export const CreateNoteFullCommand: CommandModule = {
//   id: 'createnotefull',
//   label: 'Create Full Screen Note',
//   prefix: '/createnotefull',
//   keywords: ['create note full', 'new note full', 'full screen note'],
//   behavior: 'instant',

//   execute: () => {
//     console.log('[CreateNoteFullCommand] Executing...');
//     const tempId = 'temp-' + Date.now();
//     const url = chrome.runtime.getURL(`new-tab/index.html?open_note=true&noteid=${tempId}`);

//     // Use background script to avoid ERR_BLOCKED_BY_CLIENT (same approach as AltS)
//     if (chrome.runtime?.sendMessage) {
//       chrome.runtime.sendMessage({ action: 'open_tab', url }, (response: any) => {
//         if (chrome.runtime.lastError) {
//           console.warn('[CreateNoteFullCommand] sendMessage failed:', chrome.runtime.lastError);
//           // Fallback: try chrome.tabs.create first to avoid ERR_BLOCKED_BY_CLIENT
//           if (chrome.tabs?.create) {
//             chrome.tabs.create({ url });
//           } else {
//             // Last resort fallback
//             window.open(url, '_blank');
//           }
//         }
//       });
//     } else if (chrome.tabs?.create) {
//       // Fallback if sendMessage unavailable
//       chrome.tabs.create({ url });
//     } else {
//       // Final fallback
//       window.open(url, '_blank');
//     }
//   },
// };
